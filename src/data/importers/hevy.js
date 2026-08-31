/**
 * Hevy CSV export adapter → canonical shape.
 * Format spec: .agents/v2/explorer-formats/specs/hevy.md
 *
 * Snake_case 14-column header, one row per set. The weight column NAME
 * declares the unit (`weight_kg` | `weight_lbs`) — the only one of the
 * three formats with an in-file unit signal. Never run this parser on a
 * Strong-format file (detection lives in Settings' source picker).
 */

import {
    parseCsvText,
    normalizeHeader,
    headerIndex,
    findMissingHeaders,
    parseCsvNumber,
    parseSessionDate,
    lbToKg,
    saneWeight,
    renumberSets,
    groupSessions,
    importError,
    newParseStats,
    warn,
} from './core';

const REQUIRED = ['title', 'start_time', 'exercise_title', 'set_index', 'reps'];

function findWeightColumn(headers) {
    // Both columns present → prefer weight_kg, fall back per row
    // (openweight.dev rule). Neither → malformed, never guess.
    const kg = headers.includes('weight_kg') || headers.includes('weight (kg)');
    const lbs = headers.includes('weight_lbs') || headers.includes('weight (lbs)');
    if (kg && lbs) return { mode: 'both', kgCol: 'weight_kg', lbsCol: 'weight_lbs' };
    if (kg) return { mode: 'kg', kgCol: headers.includes('weight_kg') ? 'weight_kg' : 'weight (kg)' };
    if (lbs) return { mode: 'lbs', lbsCol: headers.includes('weight_lbs') ? 'weight_lbs' : 'weight (lbs)' };
    return null;
}

function normalizeSetType(raw) {
    const s = String(raw ?? '').trim().toLowerCase();
    if (!s) return 'normal';
    switch (s) {
        case '1':
        case 'normal':
            return 'normal';
        case '2':
        case 'warmup':
        case 'warm up':
            return 'warmup';
        case '3':
        case 'dropset':
        case 'drop set':
            return 'dropset';
        case '4':
        case 'failure':
            return 'failure';
        default:
            return 'unknown';
    }
}

/** Parse a Hevy export. Units come from the header — there is no user pick. */
export function parseHevyCsv(text) {
    const rows = parseCsvText(text);
    if (!rows.length) return importError('hevy', 'File is empty — no header row found.');

    const headers = rows[0].map(normalizeHeader);
    const cols = headerIndex(headers);
    const missing = findMissingHeaders(headers, REQUIRED);
    if (missing.length) {
        return importError('hevy', `This doesn't look like a Hevy export — missing column(s): ${missing.join(', ')}.`, { missingHeaders: missing });
    }
    const weightCol = findWeightColumn(headers);
    if (!weightCol) {
        return importError('hevy', "No weight column found (expected `weight_kg` or `weight_lbs`). A unitless Hevy file would force us to guess units — refusing rather than importing wrong weights.", { missingHeaders: ['weight_kg | weight_lbs'] });
    }

    const stats = newParseStats();
    const seenSupersetIds = new Set();
    const body = rows.slice(1);

    const records = [];
    for (const row of body) {
        stats.totalRows += 1;
        const cell = (name) => {
            const i = cols.get(name);
            return i === undefined ? '' : (row[i] ?? '');
        };
        const start = parseSessionDate(cell('start_time'));
        const exerciseName = String(cell('exercise_title')).trim();

        if (!start) {
            stats.skippedRows += 1;
            warn(stats, `Unparseable start_time "${cell('start_time')}" — row skipped rather than guessing.`);
            continue;
        }
        if (!exerciseName) {
            stats.skippedRows += 1;
            warn(stats, 'Row with no exercise title was skipped.');
            continue;
        }

        // Unit read per row when both columns exist (prefer kg).
        let weightRaw = null;
        let unit = null;
        if (weightCol.mode === 'both') {
            const kgCell = String(cell('weight_kg')).trim();
            const lbsCell = String(cell('weight_lbs')).trim();
            if (kgCell) { weightRaw = kgCell; unit = 'kg'; } else if (lbsCell) { weightRaw = lbsCell; unit = 'lbs'; }
        } else {
            weightRaw = cell(weightCol.mode === 'kg' ? weightCol.kgCol : weightCol.lbsCol);
            unit = weightCol.mode;
        }
        const weightNum = weightRaw === null || String(weightRaw).trim() === '' ? null : parseCsvNumber(weightRaw);
        if (weightNum !== null && weightNum < 0) {
            stats.skippedRows += 1;
            warn(stats, `Negative weight on "${exerciseName}" — set skipped.`);
            continue;
        }

        const setType = normalizeSetType(cell('set_type'));
        if (setType === 'unknown') warn(stats, `Unknown set_type "${String(cell('set_type')).trim()}" treated as a normal set.`);
        if (setType === 'dropset') stats.dropSetCount += 1;
        if (setType === 'failure') stats.failureSetCount += 1;

        // Superset: only a bare-empty cell means "not in one" — "0" is a
        // legitimate id (hevy.md §10).
        const supersetRaw = String(cell('superset_id')).trim();
        const supersetId = supersetRaw === '' ? null : supersetRaw;
        if (supersetId !== null) seenSupersetIds.add(supersetId);

        const exerciseNotes = String(cell('exercise_notes')).trim();
        if (exerciseNotes) stats.setNotesObserved += 1;

        const endIndex = cols.get('end_time');
        const end = endIndex === undefined ? null : parseSessionDate(row[endIndex] ?? '');
        const startIndex = cols.get('set_index');
        const orderIndex = parseCsvNumber(startIndex === undefined ? '' : row[startIndex] ?? '');

        records.push({
            date: start.date,
            startedAt: start.startedAt,
            endedAt: end?.startedAt ?? null,
            workoutName: String(cell('title')).trim(),
            notes: String(cell('description')).trim(),
            exerciseName,
            supersetId,
            exerciseNotes,
            setType,
            orderIndex: orderIndex === null ? records.length : orderIndex,
            weight: weightNum,
            unit,
            reps: parseCsvNumber(cell('reps')),
            distance: parseCsvNumber(cell(weightCol.mode === 'lbs' ? 'distance_miles' : 'distance_km')),
            duration: parseCsvNumber(cell('duration_seconds')),
            rpe: parseCsvNumber(cell('rpe')),
        });
    }

    const sessions = groupSessions(records, (r) => `${r.date}|${r.workoutName}`);
    const workouts = sessions.map((session) => {
        const first = session.rows[0];
        const exercises = [];
        const byName = new Map();
        for (const r of session.rows) {
            if (!byName.has(r.exerciseName)) {
                const entry = { sourceName: r.exerciseName, supersetId: r.supersetId, sets: [] };
                byName.set(r.exerciseName, entry);
                exercises.push(entry);
            }
            const entry = byName.get(r.exerciseName);

            const allEmpty = r.weight === null && r.reps === null && r.distance === null && r.duration === null;
            if (allEmpty) {
                stats.emptyRowsDropped += 1;
                continue;
            }

            const weightValue = saneWeight(r.weight === null ? 0 : r.unit === 'lbs' ? lbToKg(r.weight) : r.weight);
            if (weightValue === null) {
                stats.skippedRows += 1;
                warn(stats, `Unparseable weight on "${r.exerciseName}" — set skipped.`);
                continue;
            }
            if (r.setType === 'dropset') {
                warn(stats, `Drop set on "${r.exerciseName}" imported as a normal set (Liftit has no drop flag).`);
            }
            if ((r.distance !== null && r.distance > 0) || (r.duration !== null && r.duration > 0)) {
                stats.cardioRows += 1;
            }

            entry.sets.push({
                weight: weightValue,
                reps: Math.max(0, Math.round(r.reps ?? 0)),
                rpe: r.rpe,
                isWarmup: r.setType === 'warmup',
                orderIndex: r.orderIndex,
            });
        }

        // Duration = end − start (the only duration signal Hevy exports).
        const startMs = first.startedAt ? Date.parse(first.startedAt) : NaN;
        const endMs = first.endedAt ? Date.parse(first.endedAt) : NaN;
        const durationSec = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
            ? Math.floor((endMs - startMs) / 1000)
            : 0;

        return {
            date: first.date,
            startedAt: first.startedAt,
            endedAt: first.endedAt,
            name: first.workoutName || 'Workout',
            notes: session.rows.map((r) => r.notes).find(Boolean) ?? '',
            durationSec,
            source: 'hevy',
            exercises: exercises.map((e) => ({ sourceName: e.sourceName, supersetId: e.supersetId, sets: renumberSets(e.sets) })),
        };
    });

    stats.parsedSets = workouts.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
    stats.supersetExercises = seenSupersetIds.size;
    if (seenSupersetIds.size) warn(stats, `${seenSupersetIds.size} superset group(s) detected — preserved in this report only (Liftit has no superset field).`);
    if (stats.dropSetCount) warn(stats, `${stats.dropSetCount} drop set(s) imported as normal sets.`);
    if (stats.failureSetCount) warn(stats, `${stats.failureSetCount} failure set(s) imported as normal sets (no Liftit flag).`);
    if (stats.setNotesObserved) warn(stats, `${stats.setNotesObserved} exercise note(s) exist in the file — listed here only.`);

    const weightHeaderName = weightCol.mode === 'kg'
        ? (headers.includes('weight_kg') ? 'weight_kg' : 'weight (kg)')
        : (headers.includes('weight_lbs') ? 'weight_lbs' : 'weight (lbs)');
    const unitReason = weightCol.mode === 'both'
        ? 'both weight columns present — weight_kg preferred per row'
        : `${weightHeaderName} header says ${weightCol.mode}`;

    return {
        ok: true,
        source: 'hevy',
        unitMode: weightCol.mode === 'both' ? 'kg' : weightCol.mode,
        unitReason,
        workouts,
        stats,
    };
}
