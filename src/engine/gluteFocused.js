import { getLibraryExercise } from '../data/exercises';

export const GLUTE_GOAL = 'glute-focused';
export const GLUTE_INTRO = 'Designed with female lifters in mind, open to anyone: quad and glute emphasis days, balanced upper-body work, and an optional third day for the whole legs.';
export const LOWER_DAY_OPTIONS = [
    { value: 2, label: '2 · Quads + Glutes' },
    { value: 3, label: '3 Quads + Glutes + Full Lower body' },
];
export const GLUTE_STUDIES = [
    { label: 'ACSM (2026) · Resistance-training guidelines', url: 'https://acsm.org/resistance-training-guidelines-update-2026/' },
    { label: 'Krause Neto et al. (2025) · Glute hypertrophy review', url: 'https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2025.1542334/full' },
    { label: 'Plotkin et al. (2023) · Squats and hip thrusts', url: 'https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1279170/full' },
    { label: 'Kassiano et al. (2024) · Training in women', url: 'https://doi.org/10.47206/ijsc.v4i1.284' },
    { label: 'Schoenfeld et al. (2019) · Training frequency', url: 'https://pubmed.ncbi.nlm.nih.gov/30558493/' },
    { label: 'Refalo et al. (2025) · Female muscle growth', url: 'https://pubmed.ncbi.nlm.nih.gov/40028215/' },
    { label: 'D’Souza et al. (2026) · Menstrual cycle and training', url: 'https://eprints.ncl.ac.uk/312484' },
];

export function trainingDaysForGoal(goal, lowerBodyDays = 2) {
    return goal === GLUTE_GOAL ? (lowerBodyDays === 3 ? [3, 4, 5] : [2, 3, 4]) : [2, 3, 4, 5, 6];
}

export function updateTrainingConfig(config, patch) {
    const next = { ...config, ...patch };
    if (patch.goal === GLUTE_GOAL && config.goal !== GLUTE_GOAL) next.durationWeeks = 8;
    const options = trainingDaysForGoal(next.goal, next.lowerBodyDays);
    return { ...next, daysPerWeek: Math.max(options[0], Math.min(options.at(-1), next.daysPerWeek)) };
}

export function gluteSchedule(days, lowerBodyDays = 2) {
    if (lowerBodyDays === 3) {
        return days === 3 ? 'Example week: Mon Quads + Upper · Thu Whole Legs + Upper · Sat Glutes + Upper.'
            : days === 4 ? 'Example week: Mon Quads · Tue Upper · Thu Whole Legs + Upper · Sat Glutes.'
                : 'Example week: Mon Quads · Tue Upper A · Thu Whole Legs · Fri Upper B · Sat Glutes.';
    }
    return days === 2 ? 'Example week: Mon Quads + Upper · Thu Glutes + Upper.'
        : days === 3 ? 'Example week: Mon Quads + Upper · Wed Upper · Fri Glutes + Upper.'
            : 'Example week: Mon Quads · Tue Upper A · Thu Glutes · Fri Upper B.';
}

// Slot targets stay explicit: a bridge substitute should retain the hip-thrust
// prescription even though the library classifies it as an isolation exercise.
const slot = (ids, sets = 3, min = 8, max = 12, rest = 150) => ({ ids, sets, min, max, rest });
const thrust = slot(['barbell-hip-thrust', 'dumbbell-hip-thrust', 'glute-bridge']);
const press = slot(['dumbbell-bench-press', 'push-up']);
const row = slot(['chest-supported-row', 'dumbbell-row', 'kettlebell-row']);
const verticalPress = slot(['seated-dumbbell-press', 'overhead-press', 'pike-push-up']);
const verticalPull = slot(['lat-pulldown', 'dumbbell-pullover', 'pull-up']);
const quads = [
    slot(['barbell-back-squat', 'leg-press', 'goblet-squat', 'bodyweight-squat']),
    slot(['bulgarian-split-squat', 'bodyweight-split-squat'], 2, 8, 12, 120),
    slot(['leg-extension', 'reverse-lunge'], 2, 10, 15, 90),
    slot(['standing-calf-raise', 'single-leg-calf-raise'], 2, 10, 15, 90),
];
const glutes = [
    thrust,
    slot(['romanian-deadlift', 'dumbbell-rdl', 'kettlebell-rdl']),
    slot(['seated-leg-curl', 'lying-leg-curl', 'hamstring-walkout'], 2, 10, 15, 90),
    slot(['cable-kickback', 'quadruped-hip-extension'], 2, 12, 20, 75),
    slot(['hip-abduction-machine', 'side-lying-hip-abduction'], 2, 12, 20, 75),
];
const upperAccessories = [
    slot(['lateral-raise', 'plank-shoulder-tap'], 2, 10, 15, 90),
    slot(['dumbbell-curl', 'chin-up'], 2, 10, 15, 90),
    slot(['cable-pushdown', 'dumbbell-overhead-extension', 'close-grip-push-up'], 2, 10, 15, 90),
];
const wholeLegs = [
    slot(['leg-press', 'goblet-squat', 'bodyweight-squat'], 2, 10, 15, 120),
    { ...thrust, sets: 2, min: 10, max: 15, rest: 120 },
    glutes[2], quads[3],
];

export function generateGluteDays(daysPerWeek, experience, allowedEquipment, lowerBodyDays = 2) {
    const mixed = daysPerWeek < 4 || (lowerBodyDays === 3 && daysPerWeek === 3);
    const templates = [
        { name: mixed ? 'Quads + Upper' : 'Quads', focus: 'quad emphasis · glutes also trained', slots: mixed ? [...quads.slice(0, 3), press, row] : quads },
        { name: 'Upper A', focus: 'chest, back, shoulders, arms', slots: [press, row, verticalPull, ...upperAccessories] },
        { name: mixed ? 'Glutes + Upper' : 'Glutes', focus: 'glute emphasis · hamstrings', slots: mixed ? [...glutes.slice(0, 4), verticalPress, verticalPull] : glutes },
        { name: 'Upper B', focus: 'shoulders, back, chest, arms', slots: [verticalPress, verticalPull, press, ...upperAccessories] },
    ];
    let selected = daysPerWeek === 2 ? [templates[0], templates[2]]
        : daysPerWeek === 3 ? templates.slice(0, 3) : templates;
    if (lowerBodyDays === 3) {
        const whole = { name: daysPerWeek < 5 ? 'Whole Legs + Upper' : 'Whole Legs', focus: 'whole legs · moderate working volume', slots: daysPerWeek < 5 ? [...wholeLegs.slice(0, 3), press, row] : wholeLegs };
        selected = daysPerWeek === 3 ? [templates[0], whole, templates[2]]
            : daysPerWeek === 4 ? [templates[0], templates[1], whole, templates[2]]
                : [templates[0], templates[1], whole, templates[3], templates[2]];
    }
    return selected.map((day, index) => ({
        dayNumber: index + 1, name: day.name, focus: day.focus, isRestDay: false,
        exercises: day.slots.map(target => {
            const exercise = target.ids.map(getLibraryExercise).find(ex => ex && (!allowedEquipment || allowedEquipment.has(ex.equipment)));
            if (!exercise) throw new Error(`Missing Glute Focused equipment alternative: ${target.ids[0]}`);
            return {
                exerciseId: exercise.id,
                targetSets: experience === 'beginner' ? Math.max(1, target.sets - 1) : target.sets,
                targetRepsMin: target.min, targetRepsMax: target.max,
                targetRpe: experience === 'beginner' ? 7 : 8, restSec: target.rest,
                notes: exerciseCue(exercise.id),
            };
        }).map((exercise, i) => ({ ...exercise, order: i + 1 })),
    }));
}

export function gluteRationale(days, experience, duration, lowerBodyDays = 2) {
    return `${GLUTE_INTRO} ${gluteSchedule(days, lowerBodyDays)} Leave at least 48 hours between lower-body sessions. ` +
        'Squats and hip thrusts both produced glute growth in a controlled trial; squats also developed the quads. ' +
        'A trial in untrained women supports adding hip thrusts to leg press and hinge work, but also added training volume. ' +
        'This split is a practical adaptation of the evidence, not a proven best program. Lower days distribute work and recovery; frequency alone is not superior when weekly volume is equal. ' +
        `${experience === 'beginner' ? 'Beginners start with fewer sets at RPE 7 (about three reps in reserve).' : 'Working sets target RPE 8 (about two reps in reserve).'} ` +
        'Warm up with easy practice sets before the first heavy exercise; the listed sets are working sets. For unilateral exercises, complete the reps on each side. ' +
        'Use controlled, comfortable range of motion. Add reps within the range, then increase load by the smallest available step when every set reaches the top at the target effort. ' +
        'Rest 2–3 minutes for main lifts and 75–120 seconds for accessories; take longer if needed. ' +
        `The ${duration}-week block keeps working volume steady, starts at easier effort and ends with a lighter deload. The optional Whole Legs day uses fewer sets per lift. Adjust effort to sleep, recovery and menstrual symptoms when relevant. Minimal equipment needs a kettlebell and pull-up bar; add resistance as you progress.`;
}

function exerciseCue(id) {
    if (id.includes('hip-thrust') || id === 'glute-bridge') return 'Pad the load if needed. Keep ribs down, lift through the hips and finish without arching the lower back.';
    if (id.includes('rdl') || id === 'romanian-deadlift') return 'Soft knees, hips back, weight close to the legs. Stop the descent before your back position changes.';
    if (id === 'cable-kickback' || id === 'quadruped-hip-extension') return 'Reps per side. Keep the pelvis steady and move through the hip without swinging or arching your back.';
    if (id === 'side-lying-hip-abduction') return 'Reps per side. Keep the pelvis steady and control the return without bouncing.';
    if (id.includes('abduction')) return 'Move through a comfortable hip range with a steady pelvis. Control the return; avoid bouncing.';
    if (id === 'plank-shoulder-tap') return 'Reps per side. Keep hips steady as you tap the opposite shoulder; use a wider stance if needed.';
    if (id.includes('split-squat') || id.includes('lunge')) return 'Reps per side. Use support for balance if needed and lower through a comfortable range.';
    if (id.includes('squat') || id === 'leg-press') return 'Use the deepest comfortable, controlled range while keeping feet planted and pelvis stable.';
    return 'Use a controlled, comfortable range. Stop with the planned reps in reserve.';
}
