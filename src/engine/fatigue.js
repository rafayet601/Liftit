/**
 * ACWR — acute:chronic workload ratio (Gabbett) from real logged volume.
 *
 * acute  = total working volume over the trailing 7 days
 * chronic= average weekly volume over the trailing 28 days (total / 4)
 * ratio  = acute / chronic
 *
 * Purely descriptive of the user's logs: no fabricated numbers, and it
 * never overrides the deterministic progression engine — it can only
 * ESCALATE a deload (see applyFatigueContext), never suppress one.
 * Weights in kg, consistent with the rest of the engine.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Working-set volume of one workout — same definition as analytics.workoutVolume
 * (deliberately duplicated so this module stays dependency-free). */
function workoutVolume(workout) {
    return (workout.sets || [])
        .filter((s) => !s.isWarmup && s.reps > 0 && s.weight > 0)
        .reduce((sum, s) => sum + s.weight * s.reps, 0);
}

export const ACWR_SPIKE_THRESHOLD = 1.3;
export const ACWR_DETREND_THRESHOLD = 0.8;
const ACUTE_DAYS = 7;
const CHRONIC_DAYS = 28; // 28d window = 4 weeks

/**
 * @param {Array} workouts all logged workouts (any order)
 * @param {Date} [now]
 * @returns {{ ratio: number|null, status: 'spike'|'detrend'|'balanced'|'insufficient_data',
 *             acuteVolume: number, chronicWeeklyVolume: number }}
 */
export function acwr(workouts, now = new Date()) {
    const t = now.getTime();
    let acute = 0;
    let chronic = 0;
    let oldestAgeMs = 0;

    for (const w of workouts || []) {
        const ts = new Date(w.startedAt).getTime();
        if (!Number.isFinite(ts)) continue;
        const age = t - ts;
        if (age < 0) continue; // future-dated logs don't count yet
        oldestAgeMs = Math.max(oldestAgeMs, age); // oldest log = largest age
        const v = workoutVolume(w);
        if (age <= ACUTE_DAYS * DAY_MS) acute += v;
        if (age <= CHRONIC_DAYS * DAY_MS) chronic += v;
    }

    const acuteVolume = Math.round(acute);
    const chronicWeeklyVolume = Math.round(chronic / 4);
    const historyDays = oldestAgeMs / DAY_MS;

    // Fewer than 7 days of history, or nothing to form a chronic baseline.
    if (historyDays < ACUTE_DAYS || chronicWeeklyVolume <= 0) {
        return { ratio: null, status: 'insufficient_data', acuteVolume, chronicWeeklyVolume };
    }

    const ratio = Math.round((acute / (chronic / 4)) * 100) / 100;
    const status =
        ratio > ACWR_SPIKE_THRESHOLD ? 'spike' : ratio < ACWR_DETREND_THRESHOLD ? 'detrend' : 'balanced';
    return { ratio, status, acuteVolume, chronicWeeklyVolume };
}

/**
 * Modulate (never override) a deload recommendation with the ACWR result.
 * - status 'spike' + no deload → ESCALATE to a deload, with the real ratio
 *   in the reason string.
 * - status 'spike' + existing deload → keep it, attach a confirming note.
 * - any other status → returned untouched.
 * A deload is never suppressed here.
 *
 * @param {{ shouldDeload: boolean, reason: string, suggestedIntensityReduction?: number, plateauWeeks?: number }|null} deloadRec
 * @param {{ status: string, ratio: number|null }} acwrResult
 */
export function applyFatigueContext(deloadRec, acwrResult) {
    if (!deloadRec || acwrResult?.status !== 'spike' || !(acwrResult.ratio > 0)) return deloadRec;

    const fatigue = { status: 'spike', ratio: acwrResult.ratio, escalated: !deloadRec.shouldDeload };
    if (!deloadRec.shouldDeload) {
        return {
            ...deloadRec,
            shouldDeload: true,
            reason:
                `Acute:chronic workload ratio is ${acwrResult.ratio} — your last 7 days exceed 1.3× ` +
                `your 4-week weekly average (${Math.round(acwrResult.acuteVolume)} vs ` +
                `${Math.round(acwrResult.chronicWeeklyVolume)} kg/week). Escalating to a deload recommendation.`,
            suggestedIntensityReduction: deloadRec.suggestedIntensityReduction || 0.9,
            fatigue,
        };
    }
    return {
        ...deloadRec,
        fatigue: { ...fatigue, escalated: false },
        reason: `${deloadRec.reason} ACWR ${acwrResult.ratio} confirms it — training load is spiking.`,
    };
}

/**
 * Modulate (never override) a deload recommendation with wearable-derived
 * readiness (see src/data/recovery.js). Symmetric with applyFatigueContext:
 * status 'fatigued' can only ESCALATE to a deload, with the real readiness
 * score in the reason string; a deload is never suppressed.
 *
 * @param {{ shouldDeload: boolean, reason: string, suggestedIntensityReduction?: number, plateauWeeks?: number }|null} deloadRec
 * @param {{ status: string, score: number }|null} readiness from computeReadiness
 */
export function applyReadinessContext(deloadRec, readiness) {
    if (!deloadRec || readiness?.status !== 'fatigued' || !Number.isFinite(readiness.score)) {
        return deloadRec;
    }

    const note = `Readiness is low (score ${readiness.score}/100 from your recovery data).`;
    if (!deloadRec.shouldDeload) {
        return {
            ...deloadRec,
            shouldDeload: true,
            reason: `${note} ${deloadRec.reason} Escalating to a deload recommendation.`,
            suggestedIntensityReduction: deloadRec.suggestedIntensityReduction || 0.9,
            readiness,
        };
    }
    return {
        ...deloadRec,
        readiness,
        reason: `${deloadRec.reason} ${note}`,
    };
}
