/**
 * Deterministic program generator.
 *
 * Builds a complete mesocycle from transparent templates: split is chosen
 * from training frequency, exercise selection from goal + available
 * equipment, and weekly targets are scaled by mesocycle phase. Instant,
 * offline, explainable.
 */

import { getLibraryExercise } from '../data/exercises';

/* ------------------------------------------------------------------ */
/* Goal parameters                                                     */
/* ------------------------------------------------------------------ */

export const GOALS = {
    strength: {
        label: 'Strength',
        compound: { sets: 4, repsMin: 4, repsMax: 6, rpe: 8, restSec: 180 },
        isolation: { sets: 3, repsMin: 6, repsMax: 10, rpe: 8, restSec: 90 },
        summary: 'heavy compound work in the 4–6 rep range with full rest',
    },
    hypertrophy: {
        label: 'Hypertrophy',
        compound: { sets: 4, repsMin: 8, repsMax: 12, rpe: 8, restSec: 150 },
        isolation: { sets: 3, repsMin: 10, repsMax: 15, rpe: 8, restSec: 75 },
        summary: 'moderate loads in the 8–15 rep range close to failure',
    },
    general: {
        label: 'General Fitness',
        compound: { sets: 3, repsMin: 6, repsMax: 10, rpe: 7.5, restSec: 150 },
        isolation: { sets: 3, repsMin: 10, repsMax: 15, rpe: 7.5, restSec: 75 },
        summary: 'a balanced mix of strength and conditioning volume',
    },
};

/* ------------------------------------------------------------------ */
/* Mesocycle phases                                                    */
/* ------------------------------------------------------------------ */

/** Phase plan for a block of `durationWeeks`; last week is always a deload. */
export function phaseForWeek(week, durationWeeks) {
    if (week >= durationWeeks) {
        return { name: 'Deload', setScale: 0.5, rpeOffset: -2, blurb: 'Half volume, easy effort. Recover.' };
    }
    const trainingWeeks = durationWeeks - 1;
    const ratio = week / trainingWeeks;
    if (ratio <= 0.5) {
        return { name: 'Accumulation', setScale: 1, rpeOffset: -0.5, blurb: 'Build volume with a rep in reserve.' };
    }
    if (ratio <= 0.85) {
        return { name: 'Intensification', setScale: 0.9, rpeOffset: 0, blurb: 'Slightly less volume, heavier and harder.' };
    }
    return { name: 'Realization', setScale: 0.75, rpeOffset: 0.5, blurb: 'Low volume, peak intensity. Express the gains.' };
}

/* ------------------------------------------------------------------ */
/* Split templates                                                     */
/* Each slot lists candidate exercise ids in preference order; the      */
/* first one whose equipment is available wins.                        */
/* ------------------------------------------------------------------ */

const SPLITS = {
    fullBody3: {
        name: 'Full Body',
        days: [
            {
                name: 'Full Body A',
                focus: 'squat + push + pull',
                slots: [
                    ['barbell-back-squat', 'goblet-squat', 'leg-press'],
                    ['barbell-bench-press', 'dumbbell-bench-press', 'push-up'],
                    ['barbell-row', 'dumbbell-row', 'seated-cable-row'],
                    ['lateral-raise', 'cable-lateral-raise'],
                    ['plank', 'ab-wheel-rollout'],
                ],
            },
            {
                name: 'Full Body B',
                focus: 'hinge + press + pull-down',
                slots: [
                    ['romanian-deadlift', 'dumbbell-rdl', 'good-morning'],
                    ['overhead-press', 'seated-dumbbell-press', 'machine-shoulder-press'],
                    ['lat-pulldown', 'pull-up', 'chin-up'],
                    ['dumbbell-curl', 'cable-curl'],
                    ['standing-calf-raise', 'single-leg-calf-raise'],
                ],
            },
            {
                name: 'Full Body C',
                focus: 'deadlift + incline + row',
                slots: [
                    ['conventional-deadlift', 'sumo-deadlift', 'kettlebell-swing'],
                    ['incline-dumbbell-press', 'incline-barbell-bench-press', 'machine-chest-press'],
                    ['seated-cable-row', 'chest-supported-row', 'machine-row'],
                    ['cable-pushdown', 'dumbbell-overhead-extension'],
                    ['hanging-leg-raise', 'cable-crunch'],
                ],
            },
        ],
    },
    upperLower4: {
        name: 'Upper / Lower',
        days: [
            {
                name: 'Upper A',
                focus: 'horizontal push + pull',
                slots: [
                    ['barbell-bench-press', 'dumbbell-bench-press', 'machine-chest-press'],
                    ['barbell-row', 'chest-supported-row', 'machine-row'],
                    ['incline-dumbbell-press', 'incline-barbell-bench-press'],
                    ['lateral-raise', 'cable-lateral-raise'],
                    ['cable-pushdown', 'skull-crusher'],
                    ['dumbbell-curl', 'barbell-curl'],
                ],
            },
            {
                name: 'Lower A',
                focus: 'squat-dominant',
                slots: [
                    ['barbell-back-squat', 'hack-squat', 'leg-press'],
                    ['romanian-deadlift', 'dumbbell-rdl'],
                    ['walking-lunge', 'bulgarian-split-squat'],
                    ['leg-extension', 'goblet-squat'],
                    ['standing-calf-raise', 'seated-calf-raise'],
                    ['plank', 'side-plank'],
                ],
            },
            {
                name: 'Upper B',
                focus: 'vertical push + pull',
                slots: [
                    ['overhead-press', 'seated-dumbbell-press', 'machine-shoulder-press'],
                    ['pull-up', 'lat-pulldown', 'chin-up'],
                    ['dumbbell-bench-press', 'dips', 'machine-chest-press'],
                    ['face-pull', 'rear-delt-fly'],
                    ['hammer-curl', 'incline-dumbbell-curl'],
                    ['overhead-cable-extension', 'dumbbell-overhead-extension'],
                ],
            },
            {
                name: 'Lower B',
                focus: 'hinge-dominant',
                slots: [
                    ['conventional-deadlift', 'sumo-deadlift', 'rack-pull'],
                    ['leg-press', 'hack-squat', 'goblet-squat'],
                    ['lying-leg-curl', 'seated-leg-curl', 'nordic-curl'],
                    ['barbell-hip-thrust', 'glute-bridge'],
                    ['seated-calf-raise', 'single-leg-calf-raise'],
                    ['hanging-leg-raise', 'cable-crunch'],
                ],
            },
        ],
    },
    ppl: {
        name: 'Push / Pull / Legs',
        days: [
            {
                name: 'Push',
                focus: 'chest, shoulders, triceps',
                slots: [
                    ['barbell-bench-press', 'dumbbell-bench-press', 'machine-chest-press'],
                    ['overhead-press', 'seated-dumbbell-press'],
                    ['incline-dumbbell-press', 'incline-barbell-bench-press'],
                    ['lateral-raise', 'cable-lateral-raise'],
                    ['cable-pushdown', 'skull-crusher'],
                    ['overhead-cable-extension', 'dumbbell-overhead-extension'],
                ],
            },
            {
                name: 'Pull',
                focus: 'back + biceps',
                slots: [
                    ['conventional-deadlift', 'rack-pull', 'sumo-deadlift'],
                    ['pull-up', 'lat-pulldown', 'chin-up'],
                    ['barbell-row', 'seated-cable-row', 'machine-row'],
                    ['face-pull', 'rear-delt-fly'],
                    ['barbell-curl', 'dumbbell-curl'],
                    ['hammer-curl', 'cable-curl'],
                ],
            },
            {
                name: 'Legs',
                focus: 'quads, hamstrings, glutes',
                slots: [
                    ['barbell-back-squat', 'hack-squat', 'leg-press'],
                    ['romanian-deadlift', 'dumbbell-rdl'],
                    ['bulgarian-split-squat', 'walking-lunge'],
                    ['lying-leg-curl', 'seated-leg-curl'],
                    ['standing-calf-raise', 'seated-calf-raise'],
                    ['hanging-leg-raise', 'plank'],
                ],
            },
        ],
    },
};

const EQUIPMENT_PRESETS = {
    full: null, // everything allowed
    'home-dumbbell': new Set(['dumbbell', 'bodyweight', 'kettlebell']),
    minimal: new Set(['bodyweight', 'kettlebell']),
};

function pickExercise(slot, allowedEquipment) {
    for (const id of slot) {
        const exercise = getLibraryExercise(id);
        if (!exercise) continue;
        if (!allowedEquipment || allowedEquipment.has(exercise.equipment)) return exercise;
    }
    return null; // no candidate fits the equipment — drop the slot
}

/* ------------------------------------------------------------------ */
/* Generator                                                           */
/* ------------------------------------------------------------------ */

/**
 * Returns a plain program object compatible with db.programs.save().
 * params: { goal, experience, daysPerWeek, durationWeeks, equipment }
 */
export function generateProgram(params = {}) {
    const goalKey = GOALS[params.goal] ? params.goal : 'hypertrophy';
    const goal = GOALS[goalKey];
    const experience = params.experience ?? 'intermediate';
    const daysPerWeek = clamp(params.daysPerWeek ?? 4, 2, 6);
    const durationWeeks = clamp(params.durationWeeks ?? 6, 4, 12);
    const allowedEquipment = EQUIPMENT_PRESETS[params.equipment ?? 'full'] ?? null;

    const split =
        daysPerWeek <= 3 ? SPLITS.fullBody3 : daysPerWeek === 4 ? SPLITS.upperLower4 : SPLITS.ppl;

    // Beginners: trim the last isolation slot of each day to keep sessions short.
    const slotTrim = experience === 'beginner' ? 1 : 0;

    const days = [];
    for (let dayNumber = 1; dayNumber <= daysPerWeek; dayNumber++) {
        const template = split.days[(dayNumber - 1) % split.days.length];
        const repeat = Math.floor((dayNumber - 1) / split.days.length);
        const slots = slotTrim ? template.slots.slice(0, -slotTrim) : template.slots;
        const exercises = [];
        for (const slot of slots) {
            const exercise = pickExercise(slot, allowedEquipment);
            if (!exercise) continue;
            const p = exercise.isCompound ? goal.compound : goal.isolation;
            exercises.push({
                exerciseId: exercise.id,
                order: exercises.length + 1,
                targetSets: p.sets,
                targetRepsMin: p.repsMin,
                targetRepsMax: p.repsMax,
                targetRpe: p.rpe,
                restSec: p.restSec,
            });
        }
        days.push({
            dayNumber,
            name: repeat > 0 ? `${template.name} ${repeat + 1}` : template.name,
            focus: template.focus,
            isRestDay: false,
            exercises,
        });
    }

    const rationale =
        `${split.name} split because you train ${daysPerWeek} days a week — every muscle is hit ` +
        `${daysPerWeek <= 4 ? '2×' : '~2×'} per week, which research consistently favors. ` +
        `Targets are set for ${goal.label.toLowerCase()}: ${goal.summary}. ` +
        `The ${durationWeeks}-week block builds volume first (accumulation), then trades volume for ` +
        `intensity (intensification → realization), and ends with a deload so you start the next block fresh. ` +
        `Weights aren't prescribed — the progression engine sets them from your logged sets.`;

    return {
        name: `${goal.label} · ${split.name}`,
        description: `${daysPerWeek}-day ${split.name} block`,
        goal: goalKey,
        experience,
        daysPerWeek,
        durationWeeks,
        startDate: new Date().toISOString(),
        isActive: true,
        rationale,
        days,
    };
}

/** Current week number (1-based) of a program, clamped to its duration. */
export function currentProgramWeek(program, now = new Date()) {
    if (!program?.startDate) return 1;
    const ms = now - new Date(program.startDate);
    const week = Math.floor(ms / (7 * 24 * 60 * 60 * 1000)) + 1;
    return clamp(week, 1, program.durationWeeks || 6);
}

/** Apply the current phase's scaling to a program-day exercise target. */
export function scaleTargetsForWeek(exerciseTarget, week, durationWeeks) {
    const phase = phaseForWeek(week, durationWeeks);
    return {
        ...exerciseTarget,
        targetSets: Math.max(1, Math.round(exerciseTarget.targetSets * phase.setScale)),
        targetRpe: clamp(exerciseTarget.targetRpe + phase.rpeOffset, 5, 10),
        phase: phase.name,
    };
}

function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}
