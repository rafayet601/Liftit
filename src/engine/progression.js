/**
 * Double-progression engine.
 *
 * Given the recent history of one exercise and its program targets, suggest
 * next-session weight/reps with a plain-language reason. Transparent rules,
 * no AI. Weights in kg; the increment respects the user's plate units.
 *
 * DOUBLE-PROGRESSION: Track both:
 * 1. Volume progression (weight × reps increase, 3-5% per week)
 * 2. Intensity progression (1RM improvement)
 * Suggest deload when both metrics plateau simultaneously.
 */

import { estimate1RM } from './e1rm';

const KG_INCREMENT = 2.5;
const LB_INCREMENT_AS_KG = 2.268; // 5 lb

// Double-progression thresholds
const VOLUME_PLATEAU_THRESHOLD = 0.98;
const INTENSITY_PLATEAU_THRESHOLD = 0.98;
const MIN_WEEKS_FOR_PLATEAU = 3;
const DELOAD_INTENSITY_REDUCTION = 0.9;
const DAY_MS = 24 * 60 * 60 * 1000;

export function loadIncrement(units = 'kg', isCompound = true) {
    const base = units === 'lbs' ? LB_INCREMENT_AS_KG : KG_INCREMENT;
    return isCompound ? base : base / 2;
}

function roundToIncrement(weightKg, units) {
    if (units === 'lbs') {
        const lbs = weightKg * 2.20462;
        return (Math.round(lbs / 2.5) * 2.5) / 2.20462;
    }
    return Math.round(weightKg / 1.25) * 1.25;
}

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
            explanation: buildExplanation({ rule: 'start_no_history', history: [] }),
        };
    }

    const last = summarize(history[0].sets);
    if (!last) {
        return {
            action: 'start',
            weight: null,
            repsMin,
            repsMax,
            reason: 'No working sets logged last time.',
            explanation: buildExplanation({ rule: 'start_no_working_sets', history }),
        };
    }

    // Deltas shared by every branch below, computed once from the real history.
    const blockAnalysis = analyzeDoubleProgression(history);
    const sharedExplanation = { history, analysis: blockAnalysis };

    /* Block-level check first: when the double-progression analyzer sees a
     * multi-week plateau or regression across volume AND intensity, that
     * outweighs the per-session rule below — pushing weight on a stalled
     * lift is exactly how plateaus get dug deeper. */
    const blockDeload = getDeloadRecommendation(blockAnalysis);
    if (blockDeload.shouldDeload && last.topWeight > 0) {
        const weight = roundToIncrement(last.topWeight * DELOAD_INTENSITY_REDUCTION, units);
        return {
            action: 'deload',
            weight,
            repsMin,
            repsMax,
            reason: `${blockDeload.reason} Drop to ~${fmt(weight, units)} and rebuild with clean reps.`,
            explanation: buildExplanation({
                ...sharedExplanation,
                rule: blockDeload.plateauWeeks ? 'deload_block_plateau' : 'deload_regression',
                plateauWeeks: blockDeload.plateauWeeks ?? null,
            }),
        };
    }

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
            explanation: buildExplanation({
                ...sharedExplanation,
                rule: 'deload_stalled_three_sessions',
                plateauWeeks: weeksBetween(history[2]?.startedAt, history[0]?.startedAt),
            }),
        };
    }

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
            explanation: buildExplanation({ ...sharedExplanation, rule: 'increase_top_of_range' }),
        };
    }

    if (last.avgRpe && last.avgRpe > 9.25) {
        const weight = roundToIncrement(Math.max(0, last.topWeight - inc), units);
        return {
            action: 'reduce',
            weight,
            repsMin,
            repsMax,
            reason: `Last session averaged RPE ${last.avgRpe.toFixed(1)} — take a small step back to keep quality high.`,
            explanation: buildExplanation({ ...sharedExplanation, rule: 'reduce_high_rpe' }),
        };
    }

    return {
        action: 'hold',
        weight: last.topWeight,
        repsMin,
        repsMax,
        reason: `Hold ${fmt(last.topWeight, units)} and push for ${Math.min(last.minReps + 1, repsMax)}+ reps per set.`,
        explanation: buildExplanation({ ...sharedExplanation, rule: 'hold_double_progression' }),
    };
}

/**
 * Audit trail attached to every suggestNextSession result. Every value is
 * computed from the sessions the engine actually looked at — the UI shows
 * these numbers verbatim and invents nothing.
 *
 * Shape: { rule, sessionsAnalyzed: [{date, topWeight, topReps, avgRpe}],
 *          volumeDeltaPct, intensityDeltaPct, plateauWindowWeeks }
 */
function buildExplanation({ rule, history, analysis, plateauWeeks = null }) {
    const sessionsAnalyzed = (history || []).slice(0, 4).map((s) => {
        const sum = summarize(s.sets);
        return {
            date: s.startedAt ? String(s.startedAt).slice(0, 10) : null,
            topWeight: sum ? sum.topWeight : null,
            topReps: sum ? sum.minReps : null,
            avgRpe: sum && sum.avgRpe != null ? Math.round(sum.avgRpe * 10) / 10 : null,
        };
    });
    const pct = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
    return {
        rule,
        sessionsAnalyzed,
        volumeDeltaPct: history?.length >= 2 ? pct(analysis?.volumeProgressionPercent) : null,
        intensityDeltaPct: history?.length >= 2 ? pct(analysis?.intensityProgressionPercent) : null,
        plateauWindowWeeks: plateauWeeks,
    };
}

/** Whole-week span between two ISO timestamps, in weeks (1 decimal); null when unparseable. */
function weeksBetween(older, newer) {
    const ms = new Date(newer).getTime() - new Date(older).getTime();
    if (!Number.isFinite(ms)) return null;
    return Math.round((ms / (7 * DAY_MS)) * 10) / 10;
}

/**
 * Explanation for the block-level recommendation shown on Progress:
 * same audit fields, derived from the same analyzer the recommendation used.
 */
export function explainProgression(sessions) {
    const history = (sessions || []).filter((s) => s.sets?.length);
    const analysis = analyzeDoubleProgression(history);
    const deloadRec = getDeloadRecommendation(analysis);
    const rule = deloadRec.shouldDeload
        ? deloadRec.plateauWeeks
            ? 'deload_block_plateau'
            : 'deload_regression'
        : `trend_${analysis.trend}`;
    return buildExplanation({
        rule,
        history,
        analysis,
        plateauWeeks: deloadRec.plateauWeeks ?? null,
    });
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

export function sessionsForExercise(workouts, exerciseId, limit = 6) {
    const sessions = [];
    for (const w of workouts) {
        const sets = (w.sets || []).filter((s) => s.exerciseId === exerciseId);
        if (sets.length) sessions.push({ workoutId: w.id, startedAt: w.startedAt, sets });
        if (sessions.length >= limit) break;
    }
    return sessions;
}

/* DOUBLE-PROGRESSION ANALYSIS */

export function getSessionMetrics(sets) {
    const working = (sets || []).filter((s) => !s.isWarmup && s.reps > 0 && s.weight > 0);
    if (!working.length) return null;
    
    const topWeight = Math.max(...working.map((s) => s.weight));
    const topSets = working.filter((s) => Math.abs(s.weight - topWeight) < 0.01);
    const avgReps = topSets.reduce((sum, s) => sum + s.reps, 0) / topSets.length;
    const volumePerSet = topWeight * avgReps;
    const e1rm = estimate1RM(topWeight, avgReps);
    
    return { volumePerSet, e1rm, topWeight, avgReps };
}

export function analyzeDoubleProgression(sessions) {
    if (!sessions || sessions.length < 2) {
        return {
            volumeProgressionPercent: 0,
            intensityProgressionPercent: 0,
            isVolumePlateau: false,
            isIntensityPlateau: false,
            weeksSinceLastGain: 0,
            trend: 'starting'
        };
    }

    const metrics = sessions
        .slice(0, 8)
        .map((s, i) => ({
            ...getSessionMetrics(s.sets),
            date: s.startedAt,
            index: i
        }))
        .filter(m => m !== null)
        .reverse();

    if (metrics.length < 2) {
        return {
            volumeProgressionPercent: 0,
            intensityProgressionPercent: 0,
            isVolumePlateau: false,
            isIntensityPlateau: false,
            weeksSinceLastGain: 0,
            trend: 'insufficient_data'
        };
    }

    const first = metrics[0];
    const recent = metrics[metrics.length - 1];
    const spanMs = new Date(recent.date).getTime() - new Date(first.date).getTime();
    const weeksDiff = Number.isFinite(spanMs) ? spanMs / (7 * DAY_MS) : 0;
    const weeksAnalyzed = Math.max(1, weeksDiff);

    const volumeProgression = ((recent.volumePerSet - first.volumePerSet) / first.volumePerSet) * 100;
    const volumePercentPerWeek = volumeProgression / weeksAnalyzed;

    const intensityProgression = ((recent.e1rm - first.e1rm) / first.e1rm) * 100;
    const intensityPercentPerWeek = intensityProgression / weeksAnalyzed;

    const recentWindow = metrics.slice(-Math.min(3, metrics.length));
    const firstRecent = recentWindow[0];
    const isVolumePlateau = 
        recentWindow.every(m => m.volumePerSet >= firstRecent.volumePerSet * VOLUME_PLATEAU_THRESHOLD && 
                                  m.volumePerSet <= firstRecent.volumePerSet * (2 - VOLUME_PLATEAU_THRESHOLD));
    
    const isIntensityPlateau = 
        recentWindow.every(m => m.e1rm >= firstRecent.e1rm * INTENSITY_PLATEAU_THRESHOLD && 
                                 m.e1rm <= firstRecent.e1rm * (2 - INTENSITY_PLATEAU_THRESHOLD));

    let weeksSinceLastVolumeGain = 0;
    let lastVolumeGainIndex = -1;
    for (let i = recentWindow.length - 1; i >= 1; i--) {
        if (recentWindow[i].volumePerSet > recentWindow[i - 1].volumePerSet) {
            lastVolumeGainIndex = i;
            break;
        }
    }
    if (lastVolumeGainIndex >= 0) {
        weeksSinceLastVolumeGain = (recentWindow.length - 1 - lastVolumeGainIndex) * (weeksAnalyzed / recentWindow.length);
    } else {
        weeksSinceLastVolumeGain = weeksAnalyzed;
    }

    let trend = 'holding';
    if (volumeProgression > 3 || intensityProgression > 2) {
        trend = 'progressing';
    } else if (isVolumePlateau && isIntensityPlateau && recentWindow.length >= 3) {
        trend = 'plateaued';
    } else if (volumeProgression < -2 || intensityProgression < -1) {
        trend = 'regressing';
    }

    return {
        volumeProgressionPercent: volumeProgression,
        intensityProgressionPercent: intensityProgression,
        volumePercentPerWeek: volumePercentPerWeek,
        intensityPercentPerWeek: intensityPercentPerWeek,
        isVolumePlateau,
        isIntensityPlateau,
        weeksSinceLastVolumeGain,
        trend,
        recentMetrics: recentWindow,
        metricsHistory: metrics
    };
}

export function getDeloadRecommendation(analysis) {
    if (!analysis) {
        return { shouldDeload: false, reason: 'Insufficient data', suggestedIntensityReduction: 0 };
    }

    const {
        isVolumePlateau,
        isIntensityPlateau,
        recentMetrics = [],
        weeksSinceLastVolumeGain = 0,
        trend
    } = analysis;

    if (isVolumePlateau && isIntensityPlateau && recentMetrics.length >= 3) {
        const plateauWeeks = Math.ceil(weeksSinceLastVolumeGain);
        if (plateauWeeks >= MIN_WEEKS_FOR_PLATEAU) {
            return {
                shouldDeload: true,
                reason: `Both volume and intensity plateaued for ${plateauWeeks}+ weeks. Time to deload and rebuild.`,
                suggestedIntensityReduction: DELOAD_INTENSITY_REDUCTION,
                plateauWeeks
            };
        }
    }

    if (trend === 'regressing') {
        return {
            shouldDeload: true,
            reason: 'Performance is declining. Consider a deload week to recover.',
            suggestedIntensityReduction: DELOAD_INTENSITY_REDUCTION,
        };
    }

    return {
        shouldDeload: false,
        reason: 'No deload needed — keep progressing.',
        suggestedIntensityReduction: 0
    };
}

export function getProgressionRecommendation(sessions, analysis, units = 'kg') {
    if (!sessions || !sessions.length) {
        return {
            title: 'Start tracking',
            description: 'Log your first session to get progression recommendations.',
            action: null,
            priority: 'info'
        };
    }

    if (analysis.trend === 'plateaued') {
        return {
            title: 'Plateau detected',
            description: 'Both volume and intensity have stalled. Consider a deload week.',
            action: 'deload',
            priority: 'warning',
            details: `${Math.round(analysis.volumeProgressionPercent)}% volume change, ${Math.round(analysis.intensityProgressionPercent)}% strength change`
        };
    }

    if (analysis.trend === 'progressing') {
        return {
            title: 'Strong progress',
            description: `You're making solid gains (${Math.round(analysis.volumePercentPerWeek)}% volume/week).`,
            action: 'continue',
            priority: 'success'
        };
    }

    if (analysis.trend === 'holding') {
        return {
            title: 'Steady state',
            description: 'Making gradual progress. Keep consistent.',
            action: 'hold',
            priority: 'info'
        };
    }

    return {
        title: 'Regressing',
        description: 'Performance declining. Review recovery and deload if needed.',
        action: 'deload',
        priority: 'warning'
    };
}
