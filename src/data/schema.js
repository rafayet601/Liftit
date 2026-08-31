/**
 * Canonical client-side data shapes for Liftit v4.
 *
 * All weights are stored in KG. Display conversion happens at the edge
 * (UnitContext). Shapes intentionally mirror the server's Prisma models
 * (WorkoutLog/WorkoutSet/Program/ProgramDay) so sync is a thin mapping.
 */

export const SCHEMA_VERSION = 3;

let counter = 0;
export function uid(prefix = 'id') {
    counter = (counter + 1) % 1000;
    return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random()
        .toString(36)
        .slice(2, 6)}`;
}

/* ------------------------------------------------------------------ */
/* Workouts                                                            */
/* ------------------------------------------------------------------ */

export function createSet(partial = {}) {
    return {
        exerciseId: partial.exerciseId ?? null,
        setNumber: partial.setNumber ?? 1,
        weight: numberOr(partial.weight, 0), // kg
        reps: intOr(partial.reps, 0),
        rpe: numberOr(partial.rpe, 0),
        isWarmup: Boolean(partial.isWarmup),
        completedAt: partial.completedAt ?? null,
    };
}

export function createWorkout(partial = {}) {
    return {
        id: partial.id ?? uid('wo'),
        name: partial.name ?? 'Workout',
        programId: partial.programId ?? null,
        programDayNumber: partial.programDayNumber ?? null,
        startedAt: partial.startedAt ?? new Date().toISOString(),
        completedAt: partial.completedAt ?? null,
        durationSec: intOr(partial.durationSec, 0),
        notes: partial.notes ?? '',
        sets: Array.isArray(partial.sets) ? partial.sets.map(createSet) : [],
    };
}

/* ------------------------------------------------------------------ */
/* Programs                                                            */
/* ------------------------------------------------------------------ */

export function createProgramExercise(partial = {}) {
    return {
        exerciseId: partial.exerciseId ?? null,
        order: intOr(partial.order, 1),
        targetSets: intOr(partial.targetSets, 3),
        targetRepsMin: intOr(partial.targetRepsMin, 8),
        targetRepsMax: intOr(partial.targetRepsMax, 12),
        targetRpe: numberOr(partial.targetRpe, 8),
        restSec: intOr(partial.restSec, 120),
        notes: partial.notes ?? '',
    };
}

export function createProgramDay(partial = {}) {
    return {
        dayNumber: intOr(partial.dayNumber, 1), // 1..daysPerWeek slot
        name: partial.name ?? 'Training Day',
        focus: partial.focus ?? '',
        isRestDay: Boolean(partial.isRestDay),
        exercises: Array.isArray(partial.exercises)
            ? partial.exercises.map(createProgramExercise)
            : [],
    };
}

export function createProgram(partial = {}) {
    return {
        id: partial.id ?? uid('prog'),
        name: partial.name ?? 'My Program',
        description: partial.description ?? '',
        goal: partial.goal ?? 'hypertrophy', // strength | hypertrophy | general
        experience: partial.experience ?? 'intermediate',
        daysPerWeek: intOr(partial.daysPerWeek, 4),
        durationWeeks: intOr(partial.durationWeeks, 6),
        startDate: partial.startDate ?? new Date().toISOString(),
        isActive: Boolean(partial.isActive),
        rationale: partial.rationale ?? '', // "why this program" explainer
        days: Array.isArray(partial.days) ? partial.days.map(createProgramDay) : [],
    };
}

/* ------------------------------------------------------------------ */
/* Bodyweight                                                          */
/* ------------------------------------------------------------------ */

export function createBodyweightEntry(partial = {}) {
    return {
        id: partial.id ?? uid('bw'),
        date: partial.date ?? new Date().toISOString(),
        weightKg: numberOr(partial.weightKg, 0), // kg; display converts at the edge
        source: partial.source === 'import' ? 'import' : 'manual',
    };
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export function createSettings(partial = {}) {
    return {
        name: partial.name ?? '',
        units: partial.units === 'lbs' ? 'lbs' : 'kg',
        experience: partial.experience ?? 'intermediate', // beginner | intermediate | advanced
        goal: partial.goal ?? 'hypertrophy',
        onboarded: Boolean(partial.onboarded),
        restTimerEnabled: partial.restTimerEnabled ?? true,
        // Opt-in wearable readiness. Off by default; the deterministic
        // engine always decides — readiness only modulates thresholds.
        recovery: { enabled: Boolean(partial.recovery?.enabled) },
        // Bring-your-own AI provider. The key never leaves this device.
        ai: {
            provider: partial.ai?.provider ?? 'none', // none | anthropic | openai | groq | custom
            model: partial.ai?.model ?? '',
            apiKey: partial.ai?.apiKey ?? '',
            baseUrl: partial.ai?.baseUrl ?? '',
        },
    };
}

/* ------------------------------------------------------------------ */
/* Root document                                                       */
/* ------------------------------------------------------------------ */

export function createDocument(partial = {}) {
    return {
        version: SCHEMA_VERSION,
        settings: createSettings(partial.settings),
        workouts: Array.isArray(partial.workouts) ? partial.workouts.map(createWorkout) : [],
        programs: Array.isArray(partial.programs) ? partial.programs.map(createProgram) : [],
        customExercises: Array.isArray(partial.customExercises) ? partial.customExercises : [],
        bodyweightEntries: Array.isArray(partial.bodyweightEntries)
            ? partial.bodyweightEntries.map(createBodyweightEntry)
            : [],
        syncQueue: Array.isArray(partial.syncQueue) ? partial.syncQueue : [],
        meta: {
            isDemo: Boolean(partial.meta?.isDemo),
            createdAt: partial.meta?.createdAt ?? new Date().toISOString(),
            lastSyncedAt: partial.meta?.lastSyncedAt ?? null,
        },
    };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function numberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

export function intOr(value, fallback) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
}
