/**
 * Estimated 1RM math and PR detection. Pure functions; weights in kg.
 */

/** Epley: w * (1 + r/30). Standard for moderate rep ranges. */
export function epley(weight, reps) {
    if (!(weight > 0) || !(reps > 0)) return 0;
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
}

/** Brzycki: w * 36 / (37 - r). Conservative at higher reps. */
export function brzycki(weight, reps) {
    if (!(weight > 0) || !(reps > 0)) return 0;
    if (reps === 1) return weight;
    if (reps >= 36) return weight * 2; // formula blows up; clamp
    return (weight * 36) / (37 - reps);
}

/**
 * Blended e1RM used across the app: average of Epley and Brzycki,
 * capped at 12 reps (estimates beyond that are noise).
 */
export function estimate1RM(weight, reps) {
    if (!(weight > 0) || !(reps > 0)) return 0;
    const r = Math.min(reps, 12);
    return Math.round(((epley(weight, r) + brzycki(weight, r)) / 2) * 10) / 10;
}

/** Best (heaviest e1RM) working set of a list of sets. */
export function bestSet(sets) {
    let best = null;
    for (const s of sets || []) {
        if (s.isWarmup) continue;
        const score = estimate1RM(s.weight, s.reps);
        if (score > 0 && (!best || score > best.score)) best = { ...s, score };
    }
    return best;
}

/**
 * Detect PRs a workout achieved for one exercise, given all *prior* sets
 * of that exercise. Returns array of { type: 'weight'|'reps'|'e1rm', ... }.
 */
export function detectPRs(workoutSets, priorSets) {
    const working = (workoutSets || []).filter((s) => !s.isWarmup && s.reps > 0 && s.weight > 0);
    if (!working.length) return [];

    let maxPriorWeight = 0;
    let maxPriorE1rm = 0;
    const priorRepsAtWeight = new Map(); // weight -> max reps
    for (const s of priorSets || []) {
        if (s.isWarmup || !(s.reps > 0) || !(s.weight > 0)) continue;
        maxPriorWeight = Math.max(maxPriorWeight, s.weight);
        maxPriorE1rm = Math.max(maxPriorE1rm, estimate1RM(s.weight, s.reps));
        priorRepsAtWeight.set(s.weight, Math.max(priorRepsAtWeight.get(s.weight) ?? 0, s.reps));
    }

    const prs = [];
    const topWeight = Math.max(...working.map((s) => s.weight));
    if (topWeight > maxPriorWeight && maxPriorWeight > 0) {
        prs.push({ type: 'weight', value: topWeight });
    }
    const topE1rm = Math.max(...working.map((s) => estimate1RM(s.weight, s.reps)));
    if (topE1rm > maxPriorE1rm && maxPriorE1rm > 0) {
        prs.push({ type: 'e1rm', value: topE1rm });
    }
    for (const s of working) {
        const prior = priorRepsAtWeight.get(s.weight);
        if (prior && s.reps > prior) {
            prs.push({ type: 'reps', value: s.reps, weight: s.weight });
            break; // one rep-PR badge is enough
        }
    }
    return prs;
}
