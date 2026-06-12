/**
 * Built-in exercise library. IDs are stable slugs — workouts and programs
 * reference exercises by these ids. User-defined exercises live in
 * db.customExercises with ids prefixed `custom_`.
 */

export const MUSCLE_GROUPS = [
    'chest',
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'quads',
    'hamstrings',
    'glutes',
    'calves',
    'core',
];

export const EQUIPMENT_TYPES = [
    'barbell',
    'dumbbell',
    'cable',
    'machine',
    'bodyweight',
    'kettlebell',
];

const ex = (id, name, primaryMuscle, equipment, opts = {}) => ({
    id,
    name,
    primaryMuscle,
    secondaryMuscles: opts.secondary ?? [],
    equipment,
    isCompound: Boolean(opts.compound),
});

export const EXERCISE_LIBRARY = [
    /* ---------------- Chest ---------------- */
    ex('barbell-bench-press', 'Barbell Bench Press', 'chest', 'barbell', { compound: true, secondary: ['triceps', 'shoulders'] }),
    ex('incline-barbell-bench-press', 'Incline Barbell Bench Press', 'chest', 'barbell', { compound: true, secondary: ['shoulders', 'triceps'] }),
    ex('dumbbell-bench-press', 'Dumbbell Bench Press', 'chest', 'dumbbell', { compound: true, secondary: ['triceps', 'shoulders'] }),
    ex('incline-dumbbell-press', 'Incline Dumbbell Press', 'chest', 'dumbbell', { compound: true, secondary: ['shoulders', 'triceps'] }),
    ex('machine-chest-press', 'Machine Chest Press', 'chest', 'machine', { compound: true, secondary: ['triceps'] }),
    ex('cable-fly', 'Cable Fly', 'chest', 'cable'),
    ex('dumbbell-fly', 'Dumbbell Fly', 'chest', 'dumbbell'),
    ex('pec-deck', 'Pec Deck', 'chest', 'machine'),
    ex('push-up', 'Push-Up', 'chest', 'bodyweight', { compound: true, secondary: ['triceps', 'shoulders', 'core'] }),
    ex('dips', 'Dips', 'chest', 'bodyweight', { compound: true, secondary: ['triceps', 'shoulders'] }),

    /* ---------------- Back ---------------- */
    ex('conventional-deadlift', 'Conventional Deadlift', 'back', 'barbell', { compound: true, secondary: ['hamstrings', 'glutes', 'core'] }),
    ex('barbell-row', 'Barbell Row', 'back', 'barbell', { compound: true, secondary: ['biceps', 'shoulders'] }),
    ex('pull-up', 'Pull-Up', 'back', 'bodyweight', { compound: true, secondary: ['biceps'] }),
    ex('chin-up', 'Chin-Up', 'back', 'bodyweight', { compound: true, secondary: ['biceps'] }),
    ex('lat-pulldown', 'Lat Pulldown', 'back', 'cable', { compound: true, secondary: ['biceps'] }),
    ex('seated-cable-row', 'Seated Cable Row', 'back', 'cable', { compound: true, secondary: ['biceps'] }),
    ex('dumbbell-row', 'Dumbbell Row', 'back', 'dumbbell', { compound: true, secondary: ['biceps'] }),
    ex('chest-supported-row', 'Chest-Supported Row', 'back', 'dumbbell', { compound: true, secondary: ['biceps'] }),
    ex('t-bar-row', 'T-Bar Row', 'back', 'barbell', { compound: true, secondary: ['biceps'] }),
    ex('machine-row', 'Machine Row', 'back', 'machine', { compound: true, secondary: ['biceps'] }),
    ex('straight-arm-pulldown', 'Straight-Arm Pulldown', 'back', 'cable'),
    ex('rack-pull', 'Rack Pull', 'back', 'barbell', { compound: true, secondary: ['glutes', 'hamstrings'] }),

    /* ---------------- Shoulders ---------------- */
    ex('overhead-press', 'Overhead Press', 'shoulders', 'barbell', { compound: true, secondary: ['triceps', 'core'] }),
    ex('seated-dumbbell-press', 'Seated Dumbbell Press', 'shoulders', 'dumbbell', { compound: true, secondary: ['triceps'] }),
    ex('machine-shoulder-press', 'Machine Shoulder Press', 'shoulders', 'machine', { compound: true, secondary: ['triceps'] }),
    ex('lateral-raise', 'Lateral Raise', 'shoulders', 'dumbbell'),
    ex('cable-lateral-raise', 'Cable Lateral Raise', 'shoulders', 'cable'),
    ex('rear-delt-fly', 'Rear Delt Fly', 'shoulders', 'dumbbell'),
    ex('face-pull', 'Face Pull', 'shoulders', 'cable', { secondary: ['back'] }),
    ex('upright-row', 'Upright Row', 'shoulders', 'barbell', { secondary: ['biceps'] }),
    ex('arnold-press', 'Arnold Press', 'shoulders', 'dumbbell', { compound: true, secondary: ['triceps'] }),

    /* ---------------- Biceps ---------------- */
    ex('barbell-curl', 'Barbell Curl', 'biceps', 'barbell'),
    ex('dumbbell-curl', 'Dumbbell Curl', 'biceps', 'dumbbell'),
    ex('hammer-curl', 'Hammer Curl', 'biceps', 'dumbbell'),
    ex('incline-dumbbell-curl', 'Incline Dumbbell Curl', 'biceps', 'dumbbell'),
    ex('cable-curl', 'Cable Curl', 'biceps', 'cable'),
    ex('preacher-curl', 'Preacher Curl', 'biceps', 'machine'),
    ex('ez-bar-curl', 'EZ-Bar Curl', 'biceps', 'barbell'),

    /* ---------------- Triceps ---------------- */
    ex('cable-pushdown', 'Cable Pushdown', 'triceps', 'cable'),
    ex('overhead-cable-extension', 'Overhead Cable Extension', 'triceps', 'cable'),
    ex('skull-crusher', 'Skull Crusher', 'triceps', 'barbell'),
    ex('close-grip-bench-press', 'Close-Grip Bench Press', 'triceps', 'barbell', { compound: true, secondary: ['chest', 'shoulders'] }),
    ex('dumbbell-overhead-extension', 'Dumbbell Overhead Extension', 'triceps', 'dumbbell'),
    ex('bench-dips', 'Bench Dips', 'triceps', 'bodyweight', { secondary: ['chest'] }),

    /* ---------------- Quads ---------------- */
    ex('barbell-back-squat', 'Barbell Back Squat', 'quads', 'barbell', { compound: true, secondary: ['glutes', 'hamstrings', 'core'] }),
    ex('front-squat', 'Front Squat', 'quads', 'barbell', { compound: true, secondary: ['glutes', 'core'] }),
    ex('leg-press', 'Leg Press', 'quads', 'machine', { compound: true, secondary: ['glutes'] }),
    ex('hack-squat', 'Hack Squat', 'quads', 'machine', { compound: true, secondary: ['glutes'] }),
    ex('bulgarian-split-squat', 'Bulgarian Split Squat', 'quads', 'dumbbell', { compound: true, secondary: ['glutes'] }),
    ex('walking-lunge', 'Walking Lunge', 'quads', 'dumbbell', { compound: true, secondary: ['glutes', 'hamstrings'] }),
    ex('leg-extension', 'Leg Extension', 'quads', 'machine'),
    ex('goblet-squat', 'Goblet Squat', 'quads', 'kettlebell', { compound: true, secondary: ['glutes', 'core'] }),

    /* ---------------- Hamstrings ---------------- */
    ex('romanian-deadlift', 'Romanian Deadlift', 'hamstrings', 'barbell', { compound: true, secondary: ['glutes', 'back'] }),
    ex('dumbbell-rdl', 'Dumbbell RDL', 'hamstrings', 'dumbbell', { compound: true, secondary: ['glutes'] }),
    ex('lying-leg-curl', 'Lying Leg Curl', 'hamstrings', 'machine'),
    ex('seated-leg-curl', 'Seated Leg Curl', 'hamstrings', 'machine'),
    ex('nordic-curl', 'Nordic Curl', 'hamstrings', 'bodyweight'),
    ex('good-morning', 'Good Morning', 'hamstrings', 'barbell', { compound: true, secondary: ['glutes', 'back'] }),
    ex('sumo-deadlift', 'Sumo Deadlift', 'hamstrings', 'barbell', { compound: true, secondary: ['glutes', 'quads', 'back'] }),

    /* ---------------- Glutes ---------------- */
    ex('barbell-hip-thrust', 'Barbell Hip Thrust', 'glutes', 'barbell', { compound: true, secondary: ['hamstrings'] }),
    ex('glute-bridge', 'Glute Bridge', 'glutes', 'bodyweight', { secondary: ['hamstrings'] }),
    ex('cable-kickback', 'Cable Kickback', 'glutes', 'cable'),
    ex('hip-abduction-machine', 'Hip Abduction Machine', 'glutes', 'machine'),
    ex('kettlebell-swing', 'Kettlebell Swing', 'glutes', 'kettlebell', { compound: true, secondary: ['hamstrings', 'core'] }),

    /* ---------------- Calves ---------------- */
    ex('standing-calf-raise', 'Standing Calf Raise', 'calves', 'machine'),
    ex('seated-calf-raise', 'Seated Calf Raise', 'calves', 'machine'),
    ex('single-leg-calf-raise', 'Single-Leg Calf Raise', 'calves', 'bodyweight'),

    /* ---------------- Core ---------------- */
    ex('plank', 'Plank', 'core', 'bodyweight'),
    ex('hanging-leg-raise', 'Hanging Leg Raise', 'core', 'bodyweight'),
    ex('cable-crunch', 'Cable Crunch', 'core', 'cable'),
    ex('ab-wheel-rollout', 'Ab Wheel Rollout', 'core', 'bodyweight'),
    ex('russian-twist', 'Russian Twist', 'core', 'bodyweight'),
    ex('side-plank', 'Side Plank', 'core', 'bodyweight'),
    ex('back-extension', 'Back Extension', 'core', 'bodyweight', { secondary: ['hamstrings', 'glutes'] }),
];

const byId = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e]));
const byName = new Map(EXERCISE_LIBRARY.map((e) => [e.name.toLowerCase(), e]));

/** Look up a built-in exercise. Custom exercises are resolved via db.js. */
export function getLibraryExercise(id) {
    return byId.get(id) ?? null;
}

/** Best-effort match of a free-text exercise name to a library entry. */
export function matchExerciseByName(name) {
    if (!name) return null;
    const needle = String(name).trim().toLowerCase();
    if (byName.has(needle)) return byName.get(needle);
    // Loose contains-match in both directions ("Bench Press" → barbell bench)
    for (const e of EXERCISE_LIBRARY) {
        const candidate = e.name.toLowerCase();
        if (candidate.includes(needle) || needle.includes(candidate)) return e;
    }
    return null;
}

export function searchLibrary(query = '', { muscle = null, equipment = null } = {}) {
    const q = query.trim().toLowerCase();
    return EXERCISE_LIBRARY.filter((e) => {
        if (muscle && e.primaryMuscle !== muscle) return false;
        if (equipment && e.equipment !== equipment) return false;
        if (q && !e.name.toLowerCase().includes(q)) return false;
        return true;
    });
}
