/**
 * Strong app CSV export adapter → canonical shape.
 * Format spec: .agents/v2/explorer-formats/specs/strong.md
 *
 * One row per set; 12 fixed columns; unitless Weight (the central
 * problem — §5); W/D letter codes inside Set Order (§6); `2h 38m`
 * duration tokens (§2).
 */

import {
    parseCsvText,
    normalizeHeader,
    headerIndex,
    findMissingHeaders,
    parseCsvNumber,
    parseSessionDate,
    parseDurationToken,
    lbToKg,
    saneWeight,
    renumberSets,
    groupSessions,
    importError,
    newParseStats,
    warn,
} from './core';

const REQUIRED = [
    'date',
    'workout name',
    'duration',
    'exercise name',
    'set order',
    'weight',
    'reps',
];

/** `Weight (kg)` / `Weight (lbs)` header variants authoritatively declare units. */
function headerUnitOverride(headers) {
    if (headers.includes('weight (kg)')) return 'kg';
    if (headers.includes('weight (lbs)')) return 'lbs';
    return null;
}

/**
 * Auto heuristic (strong.md §5): if ≥30% of sets on `(Barbell)`-suffixed
 * exercises carry weight ≥ 90 → the file is lbs; else kg. Advisory only —
 * an explicit user pick always wins (canonical §3).
 */
export function detectStrongUnit(setRecords) {
    let barbellTotal = 0;
    let barbellHeavy = 0;
    for (const r of setRecords) {
        if (!/\(barbell\)\s*$/i.test(r.exerciseName)) continue;
        if (r.weight === null) continue;
        barbellTotal += 1;
        if (r.weight >= 90) barbellHeavy += 1;
    }
    if (barbellTotal === 0) return { unit: 'kg', reason: 'heuristic: no (Barbell) sets found, defaulting to kg' };
    const pct = barbellHeavy / barbellTotal;
    return pct >= 0.3
        ? { unit: 'lbs', reason: `heuristic: ${barbellHeavy}/${barbellTotal} (${Math.round(pct * 100)}%) of (Barbell) sets are ≥ 90` }
        : { unit: 'kg', reason: `heuristic: only ${barbellHeavy}/${barbellTotal} (${Math.round(pct * 100)}%) of (Barbell) sets are ≥ 90` };
}

/**
 * Parse a Strong export.
 * @param {string} text raw CSV text
 * @param {{ unitMode?: 'auto'|'kg'|'lbs' }} options user's unit pick;
 *   explicit kg/lbs overrides everything, 'auto' defers to a unit-suffixed
 *   weight header, then to the ≥30%-of-barbell-sets-≥90 heuristic.
 */
export function parseStrongCsv(text, { unitMode = 'auto' } = {}) {
    const rows = parseCsvText(text);
    if (!rows.length) return importError('strong', 'File is empty — no header row found.');

    const headers = rows[0].map(normalizeHeader);
    const cols = headerIndex(headers);
    // Unit-suffixed weight headers (`Weight (kg)` / `Weight (lbs)`) are
    // legitimate variants of the `Weight` column (strong.md §5) — accept
    // either shape.
    const hasWeightColumn = headers.some(
        (h) => h === 'weight' || h === 'weight (kg)' || h === 'weight (lbs)',
    );
    const missing = findMissingHeaders(headers, REQUIRED)
        .filter((h) => !(h === 'weight' && hasWeightColumn));
    if (missing.length) {
        return importError('strong', `This doesn't look like a Strong export — missing column(s): ${missing.join(', ')}.`, { missingHeaders: missing });
    }
    const weightCol = headers.includes('weight') ? 'weight' : headers.includes('weight (kg)') ? 'weight (kg)' : 'weight (lbs)';

    const stats = newParseStats();
    const body = rows.slice(1);

    // Pass 1: raw per-row records (weights still in file units).
    const records = [];
    for (const row of body) {
        stats.totalRows += 1;
        const cell = (name) => row[cols.get(name)] ?? '';
        const dateParsed = parseSessionDate(cell('date'));
        const exerciseName = String(cell('exercise name')).trim();
        const setOrderRaw = String(cell('set order')).trim();

        if (!dateParsed) {
            stats.skippedRows += 1;
            warn(stats, `Row ${stats.totalRows + 1}: unparseable date "${cell('date')}" — row skipped rather than guessing.`);
            continue;
        }
        if (!exerciseName) {
            stats.skippedRows += 1;
            warn(stats, 'Row with no exercise name was skipped.');
            continue;
        }

        // Set Order: plain integer OR letter codes `W`/`D` (+ optional number).
        const orderMatch = /^([WwDd])?\s*(\d+)?$/.exec(setOrderRaw);
        let code = null;
        let orderIndex = null;
        if (orderMatch) {
            code = orderMatch[1] ? orderMatch[1].toUpperCase() : null;
            orderIndex = orderMatch[2] !== undefined ? Number(orderMatch[2]) : null;
        } else {
            warn(stats, `Set Order value "${setOrderRaw}" is not a number or W/D code — set kept in file order.`);
        }

        const weight = parseCsvNumber(cell(weightCol));
        const reps = parseCsvNumber(cell('reps'));
        const distance = parseCsvNumber(cell('distance'));
        const seconds = parseCsvNumber(cell('seconds'));
        const rpe = parseCsvNumber(cell('rpe'));
        const setNotes = String(cell('notes')).trim();
        const workoutNotes = String(cell('workout notes')).trim();
        if (setNotes) stats.setNotesObserved += 1;
        if (code === 'D') stats.dropSetCount += 1;
        if (weight !== null && weight < 0) {
            stats.skippedRows += 1;
            warn(stats, `Negative weight ${weight} on "${exerciseName}" — set skipped.`);
            continue;
        }

        records.push({
            dateRaw: cell('date'),
            date: dateParsed.date,
            startedAt: dateParsed.startedAt,
            workoutName: String(cell('workout name')).trim(),
            workoutNotes,
            durationToken: cell('duration'),
            exerciseName,
            code,
            orderIndex,
            weight,
            reps,
            distance,
            seconds,
            rpe: rpe === null ? null : rpe,
            isWarmup: code === 'W',
        });
    }

    // Pass 2: resolve the unit (§5) and convert at the edge.
    const headerUnit = headerUnitOverride(headers);
    let unit;
    let unitReason;
    if (unitMode !== 'auto') {
        unit = unitMode;
        unitReason = 'your selection';
    } else if (headerUnit) {
        unit = headerUnit;
        unitReason = `weight column header says ${headerUnit}`;
    } else {
        const detected = detectStrongUnit(records);
        unit = detected.unit;
        unitReason = detected.reason;
    }
    const toKg = (w) => (unit === 'lbs' && w !== null ? lbToKg(w) : w);

    // Pass 3: group into sessions (key = Date + Workout Name, §3).
    const sessions = groupSessions(records, (r) => `${r.date}|${r.workoutName}`);
    const workouts = sessions.map((session) => {
        const first = session.rows[0];
        const exercises = [];
        const byName = new Map();
        for (const r of session.rows) {
            if (!byName.has(r.exerciseName)) {
                const entry = { sourceName: r.exerciseName, sets: [] };
                byName.set(r.exerciseName, entry);
                exercises.push(entry);
            }
            const entry = byName.get(r.exerciseName);

            // All-empty row (no weight, reps, distance, seconds) → drop + count.
            const allEmpty = r.weight === null && r.reps === null && r.distance === null && r.seconds === null;
            if (allEmpty) {
                stats.emptyRowsDropped += 1;
                continue;
            }

            const weightKg = saneWeight(toKg(r.weight ?? 0));
            if (weightKg === null) {
                stats.skippedRows += 1;
                warn(stats, `Unparseable weight on "${r.exerciseName}" — set skipped.`);
                continue;
            }
            if (r.code === 'D') {
                warn(stats, `Drop set on "${r.exerciseName}" imported as a normal set (Liftit has no drop flag) — never dropped.`);
            }

            // Cardio/timed rows keep weight 0 / reps 0 (canonical rule 6).
            if ((r.distance !== null && r.distance > 0) || (r.seconds !== null && r.seconds > 0)) {
                stats.cardioRows += 1;
            }

            entry.sets.push({
                weight: weightKg,
                reps: Math.max(0, Math.round(r.reps ?? 0)),
                rpe: r.rpe,
                isWarmup: r.isWarmup,
                // File order is the truth: Set Order is contiguous per
                // exercise in normal exports, and W/D-coded values share the
                // same counter, so sorting by the bare number could reorder
                // warm-ups past working sets. Insertion order + renumber.
                orderIndex: entry.sets.length,
            });
        }

        return {
            date: first.date,
            startedAt: first.startedAt,
            endedAt: null,
            name: first.workoutName || 'Workout',
            notes: session.rows.map((r) => r.workoutNotes).find(Boolean) ?? '',
            durationSec: parseDurationToken(first.durationToken),
            source: 'strong',
            exercises: exercises.map((e) => ({ sourceName: e.sourceName, sets: renumberSets(e.sets) })),
        };
    });

    stats.parsedSets = workouts.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
    if (stats.dropSetCount) warn(stats, `${stats.dropSetCount} drop set(s) found (Set Order "D" codes).`);
    if (stats.setNotesObserved) warn(stats, `${stats.setNotesObserved} per-set note(s) exist in the file — Liftit sets have no notes field, so they're listed here only.`);

    return {
        ok: true,
        source: 'strong',
        unitMode: unit,
        unitReason,
        workouts,
        stats,
    };
}
