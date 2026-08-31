/**
 * FitNotes CSV export adapter → canonical shape.
 * Format spec: .agents/v2/explorer-formats/specs/fitnotes.md
 *
 * Two variants, sniffed from the header:
 *  - Android (10 cols): `Weight` + per-row `Weight Unit` — mixed-unit
 *    files are legal, so units are resolved per ROW, never per file.
 *  - iOS "FitNotes 2" (11 cols): `Weight (kg)` / `Weight (lbs)` columns
 *    (+ `Kind` metric letters).
 * Thinnest format: date-only, no workout names, no set order, no RPE.
 */

import {
    parseCsvText,
    normalizeHeader,
    headerIndex,
    findMissingHeaders,
    parseCsvNumber,
    parseSessionDate,
    parseTimeToken,
    lbToKg,
    saneWeight,
    renumberSets,
    groupSessions,
    importError,
    newParseStats,
    warn,
} from './core';

const ANDROID_REQUIRED = ['date', 'exercise', 'weight', 'weight unit', 'reps'];
const IOS_REQUIRED = ['date', 'exercise', 'reps'];

/** `kgs|kg|kilo(s)|kilogram(s)` → kg · `lbs|lb|pound(s)` → lb · else null. */
export function normalizeWeightUnit(raw) {
    const s = String(raw ?? '').trim().toLowerCase();
    if (!s) return null;
    if (/^(kgs?|kilos?|kilograms?)$/.test(s)) return 'kg';
    if (/^(lbs?|pounds?)$/.test(s)) return 'lb';
    return null;
}

function isIosVariant(headers) {
    return headers.includes('weight (kg)') || headers.includes('weight (lbs)') || headers.includes('kind');
}

export function parseFitNotesCsv(text) {
    const rows = parseCsvText(text);
    if (!rows.length) return importError('fitnotes', 'File is empty — no header row found.');

    const headers = rows[0].map(normalizeHeader);
    const cols = headerIndex(headers);
    const ios = isIosVariant(headers);
    const required = ios ? IOS_REQUIRED : ANDROID_REQUIRED;
    const missing = findMissingHeaders(headers, required);
    if (missing.length) {
        return importError('fitnotes', `This doesn't look like a FitNotes export — missing column(s): ${missing.join(', ')}.`, { missingHeaders: missing });
    }

    const stats = newParseStats();
    const body = rows.slice(1);
    const records = [];

    for (const row of body) {
        stats.totalRows += 1;
        const cell = (name) => {
            const i = cols.get(name);
            return i === undefined ? '' : (row[i] ?? '');
        };
        const exerciseName = String(cell('exercise')).trim();
        const dateParsed = parseSessionDate(cell('date'));

        if (!dateParsed) {
            stats.skippedRows += 1;
            warn(stats, `Unparseable date "${cell('date')}" — row skipped (ambiguous day/month order is never guessed).`);
            continue;
        }
        if (!exerciseName) {
            stats.skippedRows += 1;
            warn(stats, 'Row with no exercise name was skipped.');
            continue;
        }

        // --- Unit resolution (the interesting part) ---
        let unit = null;
        let unitFlagged = false;
        let weightNum = null;
        if (ios) {
            const kgCell = String(cell('weight (kg)')).trim();
            const lbsCell = String(cell('weight (lbs)')).trim();
            if (kgCell) { unit = 'kg'; weightNum = parseCsvNumber(kgCell); } else if (lbsCell) { unit = 'lb'; weightNum = parseCsvNumber(lbsCell); }
        } else {
            const unitRaw = cell('weight unit');
            const weightCell = String(cell('weight')).trim();
            unit = normalizeWeightUnit(unitRaw);
            if (!unit && weightCell) {
                // Unknown/empty unit token: report and default to kg, flagged —
                // never silently guess (fitnotes.md §5).
                unit = 'kg';
                unitFlagged = true;
                warn(stats, `Weight unit "${unitRaw || '(empty)'}" on "${exerciseName}" is not kg or lbs — assumed kg, please verify.`);
            }
            weightNum = weightCell ? parseCsvNumber(weightCell) : null;
        }
        if (weightNum !== null && weightNum < 0) {
            stats.skippedRows += 1;
            warn(stats, `Negative weight on "${exerciseName}" — set skipped.`);
            continue;
        }

        const reps = parseCsvNumber(cell('reps'));
        const distance = parseCsvNumber(cell('distance'));
        const timeRaw = cell('time');
        const timeSec = parseTimeToken(timeRaw);
        if (timeRaw.trim() && timeSec === null) {
            warn(stats, `Unparseable time "${timeRaw}" on "${exerciseName}" — the time value itself is not imported.`);
        }
        const comment = String(cell('comment') || cell('notes')).trim();
        if (comment) stats.setNotesObserved += 1;

        records.push({
            date: dateParsed.date,
            exerciseName,
            unit,
            unitFlagged,
            weight: weightNum,
            reps,
            distance,
            timeSec,
        });
    }

    // Grouping key = Date alone: same-day sessions are indistinguishable in
    // the file and merge into one canonical workout (fitnotes.md §3).
    const sessions = groupSessions(records, (r) => r.date);

    const workouts = sessions.map((session) => {
        const exercises = [];
        const byName = new Map();
        for (const r of session.rows) {
            if (!byName.has(r.exerciseName)) {
                const entry = { sourceName: r.exerciseName, sets: [] };
                byName.set(r.exerciseName, entry);
                exercises.push(entry);
            }
            const entry = byName.get(r.exerciseName);

            const allEmpty = r.weight === null && r.reps === null && r.distance === null && r.timeSec === null;
            if (allEmpty) {
                stats.emptyRowsDropped += 1;
                continue;
            }

            const weightValue = saneWeight(r.weight === null ? 0 : r.unit === 'lb' ? lbToKg(r.weight) : r.weight);
            if (weightValue === null) {
                stats.skippedRows += 1;
                warn(stats, `Unparseable weight on "${r.exerciseName}" — set skipped.`);
                continue;
            }
            if ((r.distance !== null && r.distance > 0) || (r.timeSec !== null && r.timeSec > 0)) {
                stats.cardioRows += 1;
            }

            // No set order exists — file order is the only ordering signal.
            entry.sets.push({
                weight: weightValue,
                reps: Math.max(0, Math.round(r.reps ?? 0)),
                rpe: null, // FitNotes has no RPE feature — never fabricated
                isWarmup: false,
                orderIndex: entry.sets.length,
            });
        }

        return {
            date: session.rows[0].date,
            startedAt: null, // date only — core/db synthesizes 12:00 local
            endedAt: null,
            name: 'Workout', // schema default; FitNotes exports no names
            notes: '',
            durationSec: 0,
            source: 'fitnotes',
            exercises: exercises.map((e) => ({ sourceName: e.sourceName, sets: renumberSets(e.sets) })),
        };
    });

    stats.parsedSets = workouts.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
    if (stats.setNotesObserved) warn(stats, `${stats.setNotesObserved} set comment(s) exist in the file — Liftit sets have no notes field, so they're listed here only.`);
    warn(stats, 'FitNotes exports date only: all of a day\u2019s exercises are treated as one session per date.');

    return {
        ok: true,
        source: 'fitnotes',
        unitMode: 'mixed', // per-row Weight Unit column — no file-level unit
        unitReason: 'per-row Weight Unit column (mixed units are legal)',
        workouts,
        stats,
    };
}
