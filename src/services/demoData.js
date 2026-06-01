export const SAMPLE_WEEK = [
    { day: 'Monday', focus: 'Push A', exercises: ['Bench Press', 'OHP', 'Lateral Raises', 'Triceps'] },
    { day: 'Tuesday', focus: 'Pull A', exercises: ['Deadlift', 'Rows', 'Pull-ups', 'Biceps'] },
    { day: 'Wednesday', focus: 'Rest', exercises: [] },
    { day: 'Thursday', focus: 'Legs A', exercises: ['Squat', 'RDL', 'Leg Press', 'Calf Raises'] },
    { day: 'Friday', focus: 'Push B', exercises: ['Incline Bench', 'DB Press', 'Cable Fly', 'Tricep Ext'] },
    { day: 'Saturday', focus: 'Pull B', exercises: ['Barbell Row', 'Lat Pulldown', 'Face Pull', 'Curls'] },
    { day: 'Sunday', focus: 'Rest', exercises: [] },
];

export const sampleWorkout = {
    name: 'Push Day A',
    mesocycle: 'Hypertrophy Block 1',
    week: 2,
    phase: 'Accumulation',
    exercises: [
        {
            id: 1,
            name: 'Bench Press',
            target: { sets: 4, reps: 8, weight: 83.9 },
            previousSession: { weight: 83.9, reps: 8, rpe: 8 },
            muscles: ['Chest', 'Triceps'],
        },
        {
            id: 2,
            name: 'Overhead Press',
            target: { sets: 3, reps: 10, weight: 43.1 },
            previousSession: { weight: 43.1, reps: 10, rpe: 7 },
            muscles: ['Shoulders'],
        },
        {
            id: 3,
            name: 'Incline DB Press',
            target: { sets: 3, reps: 12, weight: 22.7 },
            previousSession: { weight: 22.7, reps: 12, rpe: 8 },
            muscles: ['Chest'],
        },
        {
            id: 4,
            name: 'Lateral Raises',
            target: { sets: 4, reps: 15, weight: 9.1 },
            previousSession: { weight: 9.1, reps: 15, rpe: 7 },
            muscles: ['Shoulders'],
        },
    ],
};
