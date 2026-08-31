import { readFileSync } from 'node:fs';

/**
 * Liftit MCP tool implementations over a parsed export document.
 *
 * Plain Node ESM with zero src/* dependencies so it runs under any MCP host
 * without a bundler. The small math helpers deliberately mirror the app's
 * engine and must stay in sync with them:
 * - estimate1RM        -> src/engine/e1rm.js (Epley/Brzycki blend, 12-rep cap)
 * - workingSets        -> working-set filter used by src/engine/analytics.js
 * - trainingStreak     -> src/engine/analytics.js trainingStreak
 * - currentProgramWeek -> src/engine/generator.js currentProgramWeek
 * - trend analysis     -> src/engine/progression.js analyzeDoubleProgression
 *
 * Honest-data rule: every number is derived from the exported document.
 * Empty inputs produce empty/zero/null results, never invented values.
 * All weights are kg (the export format stores kg).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const VOLUME_PLATEAU_THRESHOLD = 0.98;
const INTENSITY_PLATEAU_THRESHOLD = 0.98;
const WEIGHT_TOLERANCE = 0.01;
const SUPPORTED_VERSIONS = [2, 3];

/* ------------------------------------------------------------------ */
/* Local helpers (mirrors of src/* logic)                               */
/* ------------------------------------------------------------------ */

function numberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function intOr(value, fallback) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
}

function round(value, digits = 0) {
    const f = 10 ** digits;
    return Math.round(value * f) / f;
}

export function workingSets(sets) {
    return (sets || []).filter((s) => !s.isWarmup && s.reps > 0 && s.weight > 0);
}

function epley(weight, reps) {
    if (!(weight > 0) || !(reps > 0)) return 0;
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
}

function brzycki(weight, reps) {
    if (!(weight > 0) || !(reps > 0)) return 0;
    if (reps === 1) return weight;
    if (reps >= 36) return weight * 2;
    return (weight * 36) / (37 - reps);
}

export function estimate1RM(weight, reps) {
    if (!(weight > 0) || !(reps > 0)) return 0;
    const r = Math.min(reps, 12);
    return Math.round(((epley(weight, r) + brzycki(weight, r)) / 2) * 10) / 10;
}

export function titleCaseId(id) {
    return String(id)
        .replace(/[-_]+/g, ' ')
        .trim()
        .replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function workoutTs(workout) {
    return new Date(workout.startedAt).getTime();
}

function isoDay(ts) {
    return new Date(ts).toISOString().slice(0, 10);
}

export function workoutVolume(workout) {
    return workingSets(workout.sets).reduce((sum, s) => sum + s.weight * s.reps, 0);
}

export function trainingStreak(workouts, now = new Date()) {
    if (!workouts.length) return 0;
    const days = new Set(workouts.map((w) => Math.floor(workoutTs(w) / DAY_MS)));
    const today = Math.floor(now.getTime() / DAY_MS);
    let streak = 0;
    let cursor = today;
    let gap = 0;
    if (!days.has(cursor)) cursor -= 1;
    while (cursor >= today - 365) {
        if (days.has(cursor)) {
            streak += 1;
            gap = 0;
        } else {
            gap += 1;
            if (gap > 1) break;
        }
        cursor -= 1;
    }
    return streak;
}

export function currentProgramWeek(program, now = new Date()) {
    if (!program?.startDate) return 1;
    const ms = now.getTime() - new Date(program.startDate).getTime();
    const week = Math.floor(ms / WEEK_MS) + 1;
    return Math.min(program.durationWeeks || 6, Math.max(1, week));
}

function getSessionMetrics(sets) {
    const working = workingSets(sets);
    if (!working.length) return null;
    const topWeight = Math.max(...working.map((s) => s.weight));
    const topSets = working.filter((s) => Math.abs(s.weight - topWeight) < WEIGHT_TOLERANCE);
    const avgReps = topSets.reduce((sum, s) => sum + s.reps, 0) / topSets.length;
    return {
        topWeight,
        avgReps,
        volumePerSet: topWeight * avgReps,
        e1rm: estimate1RM(topWeight, avgReps),
    };
}

/* ------------------------------------------------------------------ */
/* Document loading                                                    */
/* ------------------------------------------------------------------ */

export function loadDoc(path) {
    if (!path || typeof path !== 'string') {
        throw new Error(
            'No Liftit export path given. Usage: node mcp/server.js /path/to/liftit_data.json (or set LIFTIT_DOC).',
        );
    }
    let raw;
    try {
        raw = readFileSync(path, 'utf8');
    } catch (err) {
        throw new Error(`Cannot read Liftit export at ${path}: ${err.message}`);
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        throw new Error(`Invalid JSON in ${path}: ${err.message}`);
    }
    if (!SUPPORTED_VERSIONS.includes(parsed?.version)) {
        throw new Error(
            `Unsupported Liftit export version: ${JSON.stringify(parsed?.version ?? null)} in ${path}. ` +
                'Expected version 2 or 3 — re-export from Liftit (Settings → Export).',
        );
    }
    const workouts = (Array.isArray(parsed.workouts) ? parsed.workouts : [])
        .filter((w) => w && Number.isFinite(new Date(w.startedAt).getTime()))
        .map((w) => ({
            ...w,
            sets: (Array.isArray(w.sets) ? w.sets : []).map((s) => ({
                exerciseId:
                    typeof s?.exerciseId === 'string' && s.exerciseId ? s.exerciseId : null,
                weight: numberOr(s?.weight, 0),
                reps: intOr(s?.reps, 0),
                rpe: numberOr(s?.rpe, 0),
                isWarmup: Boolean(s?.isWarmup),
            })),
        }));
    const programs = (Array.isArray(parsed.programs) ? parsed.programs : []).map((p) => ({
        ...p,
        name: typeof p?.name === 'string' ? p.name : '',
        isActive: Boolean(p?.isActive),
        startDate: p?.startDate ?? null,
        durationWeeks: intOr(p?.durationWeeks, 6),
    }));
    const bodyweightEntries = (
        Array.isArray(parsed.bodyweightEntries) ? parsed.bodyweightEntries : []
    )
        .filter((e) => e && Number.isFinite(new Date(e.date).getTime()))
        .map((e) => ({ ...e, weightKg: numberOr(e.weightKg, 0) }));
    return {
        version: parsed.version,
        workouts,
        programs,
        customExercises: Array.isArray(parsed.customExercises) ? parsed.customExercises : [],
        bodyweightEntries,
    };
}

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

export function liftit_overview(doc, now = new Date()) {
    const workouts = doc.workouts || [];
    const chronological = [...workouts].sort((a, b) => workoutTs(a) - workoutTs(b));
    const active = (doc.programs || []).find((p) => p.isActive) || null;
    const bodyweight = [...(doc.bodyweightEntries || [])].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const latestBw = bodyweight.at(-1) || null;
    return {
        workoutCount: workouts.length,
        firstWorkoutDate: chronological.length ? isoDay(workoutTs(chronological[0])) : null,
        lastWorkoutDate: chronological.length
            ? isoDay(workoutTs(chronological.at(-1)))
            : null,
        totalVolumeKg: round(workouts.reduce((sum, w) => sum + workoutVolume(w), 0)),
        currentStreak: trainingStreak(workouts, now),
        activeProgram: active
            ? {
                  name: active.name || 'Untitled program',
                  week: currentProgramWeek(active, now),
                  totalWeeks: active.durationWeeks,
              }
            : null,
        bodyweightLatest: latestBw
            ? { date: isoDay(new Date(latestBw.date).getTime()), weightKg: round(latestBw.weightKg, 1) }
            : null,
    };
}

export function liftit_list_exercises(doc) {
    const byId = new Map();
    for (const w of doc.workouts || []) {
        const sets = workingSets(w.sets).filter((s) => s.exerciseId);
        if (!sets.length) continue;
        const ts = workoutTs(w);
        const seen = new Set();
        for (const s of sets) {
            const entry =
                byId.get(s.exerciseId) ??
                { exerciseId: s.exerciseId, sessions: 0, lastTs: 0, bestE1rmKg: 0 };
            if (!seen.has(s.exerciseId)) {
                seen.add(s.exerciseId);
                entry.sessions += 1;
            }
            if (ts > entry.lastTs) entry.lastTs = ts;
            const score = estimate1RM(s.weight, s.reps);
            if (score > entry.bestE1rmKg) entry.bestE1rmKg = score;
            byId.set(s.exerciseId, entry);
        }
    }
    return [...byId.values()]
        .sort((a, b) => b.lastTs - a.lastTs || a.exerciseId.localeCompare(b.exerciseId))
        .map((entry) => ({
            exerciseId: entry.exerciseId,
            sessions: entry.sessions,
            lastDate: isoDay(entry.lastTs),
            bestE1rmKg: entry.bestE1rmKg > 0 ? entry.bestE1rmKg : null,
        }));
}

function requireExerciseId(args) {
    const exerciseId = args?.exerciseId;
    if (typeof exerciseId !== 'string' || !exerciseId.trim()) {
        throw new Error('A non-empty "exerciseId" string is required (e.g. "barbell-bench-press").');
    }
    return exerciseId;
}

function clampLimit(value, fallback, max) {
    return Math.max(1, Math.min(intOr(value, fallback), max));
}

export function liftit_exercise_history(doc, args = {}) {
    const exerciseId = requireExerciseId(args);
    const limit = clampLimit(args.limit, 20, 200);
    const sessions = [];
    for (const w of doc.workouts || []) {
        const sets = workingSets(w.sets).filter((s) => s.exerciseId === exerciseId);
        if (!sets.length) continue;
        const topWeight = Math.max(...sets.map((s) => s.weight));
        const repsAtTopWeight = sets
            .filter((s) => Math.abs(s.weight - topWeight) < WEIGHT_TOLERANCE)
            .map((s) => s.reps);
        sessions.push({
            date: isoDay(workoutTs(w)),
            topWeightKg: topWeight,
            topRepsAtTopWeight: Math.max(...repsAtTopWeight),
            e1rmKg: Math.max(...sets.map((s) => estimate1RM(s.weight, s.reps))),
            sessionVolumeKg: round(sets.reduce((sum, s) => sum + s.weight * s.reps, 0)),
            ts: workoutTs(w),
        });
    }
    return sessions
        .sort((a, b) => b.ts - a.ts)
        .slice(0, limit)
        .map(({ ts, ...session }) => session);
}

export function liftit_recent_workouts(doc, args = {}) {
    const limit = clampLimit(args.limit, 10, 100);
    const customNames = new Map(
        (doc.customExercises || [])
            .filter((e) => e && typeof e.id === 'string')
            .map((e) => [e.id, typeof e.name === 'string' && e.name ? e.name : titleCaseId(e.id)]),
    );
    const workouts = [...(doc.workouts || [])]
        .sort((a, b) => workoutTs(b) - workoutTs(a))
        .slice(0, limit);
    return workouts.map((w) => {
        const sets = workingSets(w.sets);
        const ids = [];
        for (const s of w.sets || []) {
            if (s.exerciseId && !ids.includes(s.exerciseId)) ids.push(s.exerciseId);
        }
        const durationSec = numberOr(w.durationSec, 0);
        return {
            date: isoDay(workoutTs(w)),
            name: typeof w.name === 'string' && w.name ? w.name : 'Workout',
            durationMin: durationSec > 0 ? round(durationSec / 60, 1) : null,
            volumeKg: round(sets.reduce((sum, s) => sum + s.weight * s.reps, 0)),
            setCount: sets.length,
            exercises: ids.map((id) => customNames.get(id) ?? titleCaseId(id)),
        };
    });
}

export function liftit_progression(doc, args = {}) {
    const exerciseId = requireExerciseId(args);
    const sessions = [];
    for (const w of doc.workouts || []) {
        const sets = workingSets(w.sets).filter((s) => s.exerciseId === exerciseId);
        if (!sets.length) continue;
        sessions.push({ date: isoDay(workoutTs(w)), ts: workoutTs(w), sets });
    }
    const newestFirst = sessions.sort((a, b) => b.ts - a.ts).slice(0, 8);
    const sessionSummaries = newestFirst.map((s) => {
        const m = getSessionMetrics(s.sets);
        return {
            date: s.date,
            topWeightKg: m.topWeight,
            avgRepsAtTopWeight: round(m.avgReps, 1),
            e1rmKg: m.e1rm,
            volumePerSetKg: round(m.volumePerSet),
        };
    });

    const metrics = newestFirst
        .map((s) => ({ ...getSessionMetrics(s.sets), date: s.date, ts: s.ts }))
        .filter((m) => m && m.volumePerSet != null)
        .reverse();

    if (metrics.length < 2) {
        return {
            exerciseId,
            sessions: sessionSummaries,
            analysis: {
                trend: 'insufficient_data',
                volumeProgressionPercent: null,
                intensityProgressionPercent: null,
                isVolumePlateau: null,
                isIntensityPlateau: null,
            },
        };
    }

    const first = metrics[0];
    const recent = metrics.at(-1);
    const spanMs = recent.ts - first.ts;
    const weeksAnalyzed = Math.max(1, Number.isFinite(spanMs) ? spanMs / WEEK_MS : 0);

    const volumeProgression =
        ((recent.volumePerSet - first.volumePerSet) / first.volumePerSet) * 100;
    const intensityProgression = ((recent.e1rm - first.e1rm) / first.e1rm) * 100;

    const recentWindow = metrics.slice(-Math.min(3, metrics.length));
    const firstRecent = recentWindow[0];
    const isVolumePlateau = recentWindow.every(
        (m) =>
            m.volumePerSet >= firstRecent.volumePerSet * VOLUME_PLATEAU_THRESHOLD &&
            m.volumePerSet <= firstRecent.volumePerSet * (2 - VOLUME_PLATEAU_THRESHOLD),
    );
    const isIntensityPlateau = recentWindow.every(
        (m) =>
            m.e1rm >= firstRecent.e1rm * INTENSITY_PLATEAU_THRESHOLD &&
            m.e1rm <= firstRecent.e1rm * (2 - INTENSITY_PLATEAU_THRESHOLD),
    );

    let trend = 'holding';
    if (volumeProgression > 3 || intensityProgression > 2) {
        trend = 'progressing';
    } else if (isVolumePlateau && isIntensityPlateau && recentWindow.length >= 3) {
        trend = 'plateaued';
    } else if (volumeProgression < -2 || intensityProgression < -1) {
        trend = 'regressing';
    }

    return {
        exerciseId,
        sessions: sessionSummaries,
        analysis: {
            trend,
            volumeProgressionPercent: round(volumeProgression, 1),
            intensityProgressionPercent: round(intensityProgression, 1),
            isVolumePlateau,
            isIntensityPlateau,
        },
    };
}

/* ------------------------------------------------------------------ */
/* MCP tool surface                                                    */
/* ------------------------------------------------------------------ */

export const TOOL_DEFINITIONS = [
    {
        name: 'liftit_overview',
        description:
            'Training summary: workout count, first/last workout date, total volume (kg), current streak (consecutive days, 1 rest day allowed), active program with current week, latest bodyweight.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'liftit_list_exercises',
        description:
            'Distinct exercises in the export, most recent first, with session count, last trained date and best estimated 1RM (kg).',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'liftit_exercise_history',
        description:
            'Newest-first per-session history for one exercise: top weight, reps at top weight, estimated 1RM and session volume (kg).',
        inputSchema: {
            type: 'object',
            properties: {
                exerciseId: {
                    type: 'string',
                    description: 'Exercise id from the export, e.g. "barbell-bench-press".',
                },
                limit: { type: 'integer', minimum: 1, maximum: 200, default: 20 },
            },
            required: ['exerciseId'],
        },
    },
    {
        name: 'liftit_recent_workouts',
        description:
            'Newest-first recent sessions with workout name, duration, volume, working-set count and exercise names (from the export; unknown ids are title-cased slugs).',
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
            },
        },
    },
    {
        name: 'liftit_progression',
        description:
            'Trend verdict (progressing/plateaued/holding/regressing/insufficient_data) for one exercise over its last 8 sessions, with per-session top weight/reps and volume/intensity deltas.',
        inputSchema: {
            type: 'object',
            properties: {
                exerciseId: {
                    type: 'string',
                    description: 'Exercise id from the export, e.g. "back-squat".',
                },
            },
            required: ['exerciseId'],
        },
    },
];

export function callTool(doc, name, args = {}, { now = new Date() } = {}) {
    switch (name) {
        case 'liftit_overview':
            return liftit_overview(doc, now);
        case 'liftit_list_exercises':
            return liftit_list_exercises(doc);
        case 'liftit_exercise_history':
            return liftit_exercise_history(doc, args);
        case 'liftit_recent_workouts':
            return liftit_recent_workouts(doc, args);
        case 'liftit_progression':
            return liftit_progression(doc, args);
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

export function formatToolResult(result) {
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}
