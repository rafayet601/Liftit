/**
 * Analytics derived purely from logged workouts. No fabricated numbers:
 * every function returns empty/zero results when there is no data.
 */

import { estimate1RM, bestSet, detectPRs } from './e1rm';
import { acwr } from './fatigue';
import { currentProgramWeek } from './generator';

const DAY_MS = 24 * 60 * 60 * 1000;

function workingSets(workout) {
    return (workout.sets || []).filter((s) => !s.isWarmup && s.reps > 0 && s.weight > 0);
}

export function workoutVolume(workout) {
    return workingSets(workout).reduce((sum, s) => sum + s.weight * s.reps, 0);
}

/** Daily volume for the trailing `days` days: [{ date, label, volume }]. */
export function dailyVolumeSeries(workouts, days = 7, now = new Date()) {
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * DAY_MS);
        const key = d.toDateString();
        const volume = workouts
            .filter((w) => new Date(w.startedAt).toDateString() === key)
            .reduce((sum, w) => sum + workoutVolume(w), 0);
        series.push({
            date: d.toISOString().slice(0, 10),
            label: d.toLocaleDateString(undefined, { weekday: 'short' }),
            volume: Math.round(volume),
        });
    }
    return series;
}

/** Total volume in the trailing 7 days vs the 7 days before that. */
export function weeklyVolumeComparison(workouts, now = new Date()) {
    const t = now.getTime();
    let current = 0;
    let previous = 0;
    for (const w of workouts) {
        const age = t - new Date(w.startedAt).getTime();
        if (age < 0) continue;
        if (age <= 7 * DAY_MS) current += workoutVolume(w);
        else if (age <= 14 * DAY_MS) previous += workoutVolume(w);
    }
    return { current: Math.round(current), previous: Math.round(previous) };
}

/**
 * Working-set count per muscle group over the trailing `days` days,
 * using the exercise library mapping (secondary muscles count half).
 * resolveExercise: (id) => exercise | null  (pass db.exercises.byId)
 */
export function muscleGroupSets(workouts, resolveExercise, days = 28, now = new Date()) {
    const cutoff = now.getTime() - days * DAY_MS;
    const tally = {};
    for (const w of workouts) {
        if (new Date(w.startedAt).getTime() < cutoff) continue;
        for (const s of workingSets(w)) {
            const exercise = resolveExercise(s.exerciseId);
            if (!exercise) continue;
            tally[exercise.primaryMuscle] = (tally[exercise.primaryMuscle] ?? 0) + 1;
            for (const m of exercise.secondaryMuscles || []) {
                tally[m] = (tally[m] ?? 0) + 0.5;
            }
        }
    }
    return tally; // { muscle: setCount }
}

/** e1RM trend for one exercise: [{ date, e1rm, weight, reps }] oldest first. */
export function e1rmTrend(workouts, exerciseId, limit = 30) {
    const points = [];
    for (const w of workouts) {
        const sets = (w.sets || []).filter((s) => s.exerciseId === exerciseId);
        const top = bestSet(sets);
        if (top) {
            points.push({
                date: w.startedAt.slice(0, 10),
                e1rm: estimate1RM(top.weight, top.reps),
                weight: top.weight,
                reps: top.reps,
            });
        }
    }
    return points.reverse().slice(-limit);
}

/**
 * All-time PR events across the history (chronological scan).
 * Returns newest-first: [{ date, workoutId, exerciseId, prs: [...] }].
 */
export function prTimeline(workouts, limit = 20) {
    const chronological = [...workouts].sort(
        (a, b) => new Date(a.startedAt) - new Date(b.startedAt),
    );
    const priorByExercise = new Map();
    const events = [];
    for (const w of chronological) {
        const byExercise = new Map();
        for (const s of workingSets(w)) {
            if (!byExercise.has(s.exerciseId)) byExercise.set(s.exerciseId, []);
            byExercise.get(s.exerciseId).push(s);
        }
        for (const [exerciseId, sets] of byExercise) {
            const prior = priorByExercise.get(exerciseId) ?? [];
            const prs = detectPRs(sets, prior);
            if (prs.length) {
                events.push({ date: w.startedAt, workoutId: w.id, exerciseId, prs });
            }
            priorByExercise.set(exerciseId, prior.concat(sets));
        }
    }
    return events.reverse().slice(0, limit);
}

/** Consecutive-training-day streak counting rest gaps of 1 day as kept. */
export function trainingStreak(workouts, now = new Date()) {
    if (!workouts.length) return 0;
    const days = new Set(
        workouts.map((w) => Math.floor(new Date(w.startedAt).getTime() / DAY_MS)),
    );
    const today = Math.floor(now.getTime() / DAY_MS);
    let streak = 0;
    let cursor = today;
    let gap = 0;
    // Allow starting today or yesterday.
    if (!days.has(cursor)) cursor -= 1;
    while (cursor >= today - 365) {
        if (days.has(cursor)) {
            streak += 1;
            gap = 0;
        } else {
            gap += 1;
            if (gap > 1) break; // more than one rest day breaks the streak
        }
        cursor -= 1;
    }
    return streak;
}

/** Map of ISO date → workout count for the trailing `days` (heatmap). */
export function frequencyHeatmap(workouts, days = 84, now = new Date()) {
    const cutoff = now.getTime() - days * DAY_MS;
    const map = {};
    for (const w of workouts) {
        const t = new Date(w.startedAt).getTime();
        if (t < cutoff) continue;
        const key = new Date(t).toISOString().slice(0, 10);
        map[key] = (map[key] ?? 0) + 1;
    }
    return map;
}

/** Exercise ids that appear in history, most-recent first (for pickers). */
export function recentExerciseIds(workouts, limit = 12) {
    const seen = [];
    for (const w of workouts) {
        for (const s of w.sets || []) {
            if (s.exerciseId && !seen.includes(s.exerciseId)) seen.push(s.exerciseId);
            if (seen.length >= limit) return seen;
        }
    }
    return seen;
}

/** Per-session volume for one exercise: [{ date, volume }] oldest first. */
export function volumeTrend(workouts, exerciseId, limit = 30) {
    const points = [];
    for (const w of workouts) {
        const sets = (w.sets || []).filter(
            (s) => s.exerciseId === exerciseId && !s.isWarmup && s.reps > 0 && s.weight > 0,
        );
        if (sets.length) {
            points.push({
                date: w.startedAt.slice(0, 10),
                volume: Math.round(sets.reduce((sum, s) => sum + s.weight * s.reps, 0)),
            });
        }
    }
    return points.reverse().slice(-limit);
}

/**
 * A grounded weekly volume target, never fabricated:
 * - With an active program: your average volume per working set (last 28
 *   days) × the working sets the program schedules per week.
 * - Without a program: match last week's volume (maintain).
 * Returns 0 when there isn't enough data to justify a target.
 */
export function weeklyVolumeTarget(workouts, program, resolveExercise, now = new Date()) {
    const t = now.getTime();

    if (program) {
        let recentVolume = 0;
        let recentSets = 0;
        for (const w of workouts) {
            const age = t - new Date(w.startedAt).getTime();
            if (age < 0 || age > 28 * DAY_MS) continue;
            for (const s of workingSets(w)) {
                recentVolume += s.weight * s.reps;
                recentSets += 1;
            }
        }
        const plannedSets = program.days
            .filter((d) => !d.isRestDay)
            .reduce((sum, d) => sum + (d.exercises || []).reduce((n, e) => n + (e.targetSets || 0), 0), 0);
        if (!recentSets || !plannedSets) return 0;
        return Math.round((recentVolume / recentSets) * plannedSets);
    }

    const { previous } = weeklyVolumeComparison(workouts, now);
    return previous > 0 ? previous : 0;
}

/**
 * Weekly digest — every field derived from real logs (or honestly empty).
 * Returns: { volumeCmp, volumeDeltaPct, prCount, sessions, acwrStatus,
 *            programWeek, message }.
 * `message` is assembled only from the computed values in this object.
 */
export function weeklyDigest(workouts, program, now = new Date()) {
    const t = now.getTime();
    const volumeCmp = weeklyVolumeComparison(workouts, now);
    const volumeDeltaPct =
        volumeCmp.previous > 0
            ? Math.round(((volumeCmp.current - volumeCmp.previous) / volumeCmp.previous) * 1000) / 10
            : null;

    const weekAgo = t - 7 * DAY_MS;
    const sessions = workouts.filter((w) => {
        const ts = new Date(w.startedAt).getTime();
        return ts >= weekAgo && ts <= t;
    }).length;

    // PR events whose workout fell in the trailing 7 days. prTimeline returns
    // newest-first with a cap — scan enough events to cover the window.
    const prEvents = prTimeline(workouts, Math.max(20, workouts.length));
    const prCount = prEvents.filter((e) => new Date(e.date).getTime() >= weekAgo).length;

    const fatigueStatus = acwr(workouts, now).status;

    let weekLabel = null;
    if (program) {
        weekLabel = `program week ${currentProgramWeek(program, now)} of ${program.durationWeeks}`;
    }

    const parts = [];
    if (!workouts.length) {
        parts.push('No sessions logged yet — your digest starts once you train.');
    } else if (sessions === 0) {
        parts.push('No sessions in the last 7 days.');
    } else {
        parts.push(`${sessions} session${sessions === 1 ? '' : 's'} this week`);
    }
    if (sessions > 0 || volumeCmp.current > 0) {
        parts.push(
            volumeDeltaPct === null
                ? `${Math.round(volumeCmp.current).toLocaleString()} kg volume this week (no prior week to compare)`
                : `volume ${volumeDeltaPct >= 0 ? '+' : ''}${volumeDeltaPct}% vs last week`,
        );
    }
    if (workouts.length) {
        parts.push(prCount > 0 ? `${prCount} PR${prCount === 1 ? '' : 's'}` : 'no new PRs');
    }
    if (weekLabel) parts.push(weekLabel);

    const acwrLabels = {
        spike: 'load spike',
        detrend: 'load taper',
        balanced: 'balanced load',
        insufficient_data: 'building load history',
    };
    if (workouts.length) parts.push(acwrLabels[fatigueStatus]);

    return {
        volumeCmp,
        volumeDeltaPct,
        prCount,
        sessions,
        acwrStatus: fatigueStatus,
        programWeek: weekLabel,
        message: parts.join(' · '),
    };
}
