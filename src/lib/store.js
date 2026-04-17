/**
 * Simple store management for Liftit
 * Using localStorage to persist data
 */

const STORAGE_KEY = 'liftit_data_v1';

const defaultData = {
    user: {
        name: 'Athlete',
        level: 'Intermediate', // Beginner, Intermediate, Advanced
    },
    currentMesocycle: {
        active: false,
        name: '',
        weeks: 0,
        currentWeek: 1,
        daysPerWeek: 4,
        focus: 'Hypertrophy',
        startDate: null,
    },
    program: [], // Array of workout days
    logs: [], // History of potentially different structure
};

export const loadData = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : defaultData;
    } catch (e) {
        console.error('Failed to load data', e);
        return defaultData;
    }
};

export const saveData = (data) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save data', e);
    }
};

// Helper: Progressive Overload Logic
// Suggests weight increase if RPE was low or reps were high
export const getProgressionRecommendation = (previousLog) => {
    if (!previousLog) return 'Start moderate';

    const { rpe, reps, weight } = previousLog;

    if (rpe < 7) {
        return `Increase weight (Easy RPE ${rpe})`;
    } else if (rpe > 9) {
        return `Maintain or slight deload (High RPE ${rpe})`;
    } else {
        // RPE 7-9 is sweet spot
        return `Maintain weight, aim for +1 rep`;
    }
};
