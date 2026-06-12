/**
 * Double-progression engine.
 *
 * Given the recent history of one exercise and its program targets, suggest
 * next-session weight/reps with a plain-language reason. Transparent rules,
 * no AI. Weights in kg; the increment respects the user's plate units.
 */

const KG_INCREMENT = 2.5;
const LB_INCREMENT_AS_KG = 2.268; // 5 lb

export function loadIncrement(units = 'kg', isCompound = true) {
    const base = units === 'lbs' ? LB_INCREMENT_AS_KG : KG_INCREMENT;
    return isCompound ? base : base / 2; // smaller jumps for isolation work
}

function roundToIncrement(weightKg, units) {
    if (units === 'lbs') {
        const lbs = weightKg * 2.20462;
        return (Math.round(lbs / 2.5) * 2.5) / 2.20462;
    }
    return Math.round(weightKg / 1.25) * 1.25;
}

/**
 * sessions: array (newest first) of { sets: [{weight, reps, rpe}] } for ONE
 * exercise — working sets only.
 * targets: { repsMin, repsMax, rpe } from the program (rpe optional).
 * options: { units, isCompound }
 *
 * Returns { action, weight, repsMin, repsMax, reason } — weight in kg.
 */
export function suggestNextSession(sessions, targets, options = {}) {
    const { units = 'kg', isCompound = true } = options;
    const repsMin = targets?.repsMin ?? 8;
    const repsMax = targets?.repsMax ?? 12;
    const targetRpe = targets?.rpe ?? 8;
    const inc = loadIncrement(units, isCompound);

    const history = (sessions || []).filter((s) => s.sets?.length);
    if (!history.length) {
        return {
            action: 'start',
            weight: null,
            repsMin,
            repsMax,
            reason: 'No history yet — pick a weight you can lift for the top of the rep range at RPE 7.',
        };
    }

    const last = summarize(history[0].sets);
    if (!last) {
        return { action: 'start', weight: null, repsMin, repsMax, reason: 'No working sets logged last time.' };
    }

    // Stall detection: 3+ sessions at the same weight without hitting the top
    // of the rep range → deload ~10%.
    const stalled =
        history.length >= 3 &&
        history.slice(0, 3).every((s) => {
            const sum = summarize(s.sets);
            return sum && Math.abs(sum.topWeight - last.topWeight) < 0.01 && sum.minReps < repsMax;
        });
    if (stalled) {
        const weight = roundToIncrement(last.topWeight * 0.9, units);
        return {
            action: 'deload',
            weight,
            repsMin,
            repsMax,
            reason: `Three sessions stuck at ${fmt(last.topWeight, units)} — back off ~10% and build back up.`,
        };
    }

    // All sets at/above the top of the range, with effort in budget → add load.
    const hitTop = last.minReps >= repsMax;
    const effortOk = !last.avgRpe || last.avgRpe <= targetRpe + 0.5;
    if (hitTop && effortOk) {
        const weight = roundToIncrement(last.topWeight + inc, units);
        return {
            action: 'increase',
            weight,
            repsMin,
            repsMax,
            reason: `You hit ${repsMax}+ reps on every set${last.avgRpe ? ` at RPE ${last.avgRpe.toFixed(1)}` : ''} — add ${fmt(inc, units, true)}.`,
        };
    }

    // Very hard session (avg RPE > 9.25) → repeat with slightly less load.
    if (last.avgRpe && last.avgRpe > 9.25) {
        const weight = roundToIncrement(Math.max(0, last.topWeight - inc), units);
        return {
            action: 'reduce',
            weight,
            repsMin,
            repsMax,
            reason: `Last session averaged RPE ${last.avgRpe.toFixed(1)} — take a small step back to keep quality high.`,
        };
    }

    // Default: same weight, chase reps.
    return {
        action: 'hold',
        weight: last.topWeight,
        repsMin,
        repsMax,
        reason: `Hold ${fmt(last.topWeight, units)} and push for ${Math.min(last.minReps + 1, repsMax)}+ reps per set.`,
    };
}

function summarize(sets) {
    const working = (sets || []).filter((s) => !s.isWarmup && s.reps > 0 && s.weight > 0);
    if (!working.length) return null;
    const topWeight = Math.max(...working.map((s) => s.weight));
    const topSets = working.filter((s) => Math.abs(s.weight - topWeight) < 0.01);
    const rpes = working.filter((s) => s.rpe > 0).map((s) => s.rpe);
    return {
        topWeight,
        minReps: Math.min(...topSets.map((s) => s.reps)),
        avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
    };
}

function fmt(kg, units, isIncrement = false) {
    if (units === 'lbs') {
        const lbs = kg * 2.20462;
        const rounded = isIncrement ? Math.round(lbs) : Math.round(lbs * 10) / 10;
        return `${rounded} lbs`;
    }
    return `${Math.round(kg * 100) / 100} kg`;
}

/**
 * Group a flat workout history into per-exercise session lists (newest
 * first), ready for suggestNextSession.
 * workouts: db.workouts.list() output.
 */
export function sessionsForExercise(workouts, exerciseId, limit = 6) {
    const sessions = [];
    for (const w of workouts) {
        const sets = (w.sets || []).filter((s) => s.exerciseId === exerciseId);
        if (sets.length) sessions.push({ workoutId: w.id, startedAt: w.startedAt, sets });
        if (sessions.length >= limit) break;
    }
    return sessions;
}
