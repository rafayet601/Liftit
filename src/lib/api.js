import axios from 'axios';
import { loadData, saveData } from './store';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

let isDemoMode = false;
let demoModeChecked = false;

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
    timeout: 3000,
});

api.interceptors.request.use(
    (config) => {
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            // Don't clear credentials or redirect if in demo mode.
            // Demo tokens are fake and will always fail server validation.
            if (!isDemoMode) {
                localStorage.removeItem('liftit_user');
                if (
                    typeof window !== 'undefined' &&
                    window.location.pathname !== '/login'
                ) {
                    // Soft SPA redirect via a custom event the Router listens
                    // to. This avoids a full-page reload that would blow away
                    // in-progress state (e.g. a workout being logged).
                    window.dispatchEvent(
                        new CustomEvent('liftit:auth-expired', {
                            detail: { from: window.location.pathname },
                        }),
                    );
                }
            }
            return Promise.reject(error);
        }

        if (error.code === 'ECONNABORTED' || !error.response) {
            enableDemoMode();
        }

        return Promise.reject(error);
    }
);

export const enableDemoMode = () => {
    if (!isDemoMode) {
        isDemoMode = true;
        console.log('[Liftit] Demo mode enabled - Using local data');
    }
};

export const disableDemoMode = () => {
    isDemoMode = false;
};

export const isInDemoMode = () => isDemoMode;

export const checkApiHealth = async () => {
    if (demoModeChecked) return !isDemoMode;
    
    try {
        await axios.get(`${API_BASE_URL}/health`, { timeout: 2000 });
        demoModeChecked = true;
        return true;
    } catch {
        demoModeChecked = true;
        enableDemoMode();
        return false;
    }
};

export const getDemoUser = () => {
    const stored = loadData();
    return {
        id: 'demo-user',
        name: stored.user?.name || 'Demo Athlete',
        email: 'demo@liftit.app',
        image: null,
        level: stored.user?.level || 'Intermediate',
        unit: 'kg',
        createdAt: new Date().toISOString(),
    };
};

export const getDemoStats = () => {
    const stored = loadData();
    return {
        totalWorkouts: stored.logs?.length || 0,
        workoutsThisWeek: stored.logs?.filter(log => {
            const logDate = new Date(log.date);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return logDate >= weekAgo;
        }).length || 2,
        workoutsThisMonth: stored.logs?.filter(log => {
            const logDate = new Date(log.date);
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return logDate >= monthAgo;
        }).length || 8,
        trainingStreak: 5,
        weeklyVolume: 25000,
        weeklyTargetVolume: 60000,
        activeProgram: stored.currentMesocycle?.active ? {
            id: 'demo-program',
            name: stored.currentMesocycle.name || 'Demo Program',
            mesocycle: stored.currentMesocycle,
        } : null,
    };
};

export const getDemoProgram = () => {
    const stored = loadData();
    
    if (stored.currentMesocycle?.active) {
        return {
            id: 'demo-program',
            name: stored.currentMesocycle.name || 'Demo Program',
            isActive: true,
            mesocycle: {
                phase: stored.currentMesocycle.focus || 'Hypertrophy',
                weeks: stored.currentMesocycle.weeks || 6,
                currentWeek: stored.currentMesocycle.currentWeek || 1,
            },
            programDays: getDemoProgramDays(),
        };
    }
    
    return null;
};

const getDemoProgramDays = () => [
    {
        id: 'day-1',
        name: 'Push A',
        dayOfWeek: 1,
        exercises: [
            { id: 'ex-1', exercise: { id: 1, name: 'Bench Press', muscle: 'Chest' }, targetSets: 4, targetReps: '8-10', targetRPE: 8 },
            { id: 'ex-2', exercise: { id: 2, name: 'Overhead Press', muscle: 'Shoulders' }, targetSets: 3, targetReps: '8-12', targetRPE: 8 },
            { id: 'ex-3', exercise: { id: 3, name: 'Incline DB Press', muscle: 'Chest' }, targetSets: 3, targetReps: '10-12', targetRPE: 7 },
            { id: 'ex-4', exercise: { id: 4, name: 'Lateral Raises', muscle: 'Shoulders' }, targetSets: 4, targetReps: '12-15', targetRPE: 7 },
        ],
    },
    {
        id: 'day-2',
        name: 'Pull A',
        dayOfWeek: 2,
        exercises: [
            { id: 'ex-5', exercise: { id: 5, name: 'Deadlift', muscle: 'Back' }, targetSets: 4, targetReps: '5-6', targetRPE: 8 },
            { id: 'ex-6', exercise: { id: 6, name: 'Barbell Rows', muscle: 'Back' }, targetSets: 4, targetReps: '8-10', targetRPE: 8 },
            { id: 'ex-7', exercise: { id: 7, name: 'Pull-ups', muscle: 'Back' }, targetSets: 3, targetReps: '8-12', targetRPE: 8 },
            { id: 'ex-8', exercise: { id: 8, name: 'Face Pulls', muscle: 'Rear Delts' }, targetSets: 3, targetReps: '15-20', targetRPE: 7 },
        ],
    },
    {
        id: 'day-3',
        name: 'Rest',
        dayOfWeek: 3,
        exercises: [],
    },
    {
        id: 'day-4',
        name: 'Legs A',
        dayOfWeek: 4,
        exercises: [
            { id: 'ex-9', exercise: { id: 9, name: 'Squat', muscle: 'Quads' }, targetSets: 4, targetReps: '6-8', targetRPE: 8 },
            { id: 'ex-10', exercise: { id: 10, name: 'Romanian Deadlift', muscle: 'Hamstrings' }, targetSets: 3, targetReps: '8-10', targetRPE: 8 },
            { id: 'ex-11', exercise: { id: 11, name: 'Leg Press', muscle: 'Quads' }, targetSets: 3, targetReps: '10-12', targetRPE: 7 },
            { id: 'ex-12', exercise: { id: 12, name: 'Calf Raises', muscle: 'Calves' }, targetSets: 4, targetReps: '12-15', targetRPE: 7 },
        ],
    },
    {
        id: 'day-5',
        name: 'Push B',
        dayOfWeek: 5,
        exercises: [
            { id: 'ex-13', exercise: { id: 13, name: 'Incline Bench', muscle: 'Chest' }, targetSets: 4, targetReps: '8-10', targetRPE: 8 },
            { id: 'ex-14', exercise: { id: 14, name: 'Dumbbell Press', muscle: 'Chest' }, targetSets: 3, targetReps: '10-12', targetRPE: 7 },
            { id: 'ex-15', exercise: { id: 15, name: 'Tricep Pushdowns', muscle: 'Triceps' }, targetSets: 3, targetReps: '10-12', targetRPE: 7 },
            { id: 'ex-16', exercise: { id: 16, name: 'Overhead Tricep Ext', muscle: 'Triceps' }, targetSets: 3, targetReps: '12-15', targetRPE: 7 },
        ],
    },
    {
        id: 'day-6',
        name: 'Pull B',
        dayOfWeek: 6,
        exercises: [
            { id: 'ex-17', exercise: { id: 17, name: 'Lat Pulldown', muscle: 'Back' }, targetSets: 4, targetReps: '10-12', targetRPE: 7 },
            { id: 'ex-18', exercise: { id: 18, name: 'Cable Rows', muscle: 'Back' }, targetSets: 4, targetReps: '10-12', targetRPE: 7 },
            { id: 'ex-19', exercise: { id: 19, name: 'Bicep Curls', muscle: 'Biceps' }, targetSets: 3, targetReps: '12-15', targetRPE: 7 },
            { id: 'ex-20', exercise: { id: 20, name: 'Hammer Curls', muscle: 'Biceps' }, targetSets: 3, targetReps: '12-15', targetRPE: 7 },
        ],
    },
    {
        id: 'day-7',
        name: 'Rest',
        dayOfWeek: 0,
        exercises: [],
    },
];

export const getDemoWorkoutHistory = () => {
    const stored = loadData();
    return stored.logs || [];
};

export const getDemoWorkoutById = (id) => {
    const stored = loadData();
    const history = stored.logs || [];
    return history.find(log => log.id === id || log.date === id) || null;
};

export const getDemoExercises = () => {
    return [
        { id: 1, name: 'Bench Press', muscle: 'Chest', category: 'compound' },
        { id: 2, name: 'Overhead Press', muscle: 'Shoulders', category: 'compound' },
        { id: 3, name: 'Incline DB Press', muscle: 'Chest', category: 'compound' },
        { id: 4, name: 'Lateral Raises', muscle: 'Shoulders', category: 'isolation' },
        { id: 5, name: 'Deadlift', muscle: 'Back', category: 'compound' },
        { id: 6, name: 'Barbell Rows', muscle: 'Back', category: 'compound' },
        { id: 7, name: 'Pull-ups', muscle: 'Back', category: 'compound' },
        { id: 8, name: 'Face Pulls', muscle: 'Rear Delts', category: 'isolation' },
        { id: 9, name: 'Squat', muscle: 'Quads', category: 'compound' },
        { id: 10, name: 'Romanian Deadlift', muscle: 'Hamstrings', category: 'compound' },
        { id: 11, name: 'Leg Press', muscle: 'Quads', category: 'compound' },
        { id: 12, name: 'Calf Raises', muscle: 'Calves', category: 'isolation' },
        { id: 13, name: 'Incline Bench', muscle: 'Chest', category: 'compound' },
        { id: 14, name: 'Dumbbell Press', muscle: 'Chest', category: 'compound' },
        { id: 15, name: 'Tricep Pushdowns', muscle: 'Triceps', category: 'isolation' },
        { id: 16, name: 'Overhead Tricep Ext', muscle: 'Triceps', category: 'isolation' },
        { id: 17, name: 'Lat Pulldown', muscle: 'Back', category: 'compound' },
        { id: 18, name: 'Cable Rows', muscle: 'Back', category: 'compound' },
        { id: 19, name: 'Bicep Curls', muscle: 'Biceps', category: 'isolation' },
        { id: 20, name: 'Hammer Curls', muscle: 'Biceps', category: 'isolation' },
    ];
};

export const getDemoAnalytics = () => {
    return {
        weeklyVolumeData: [
            { name: 'Mon', actual: 12500, target: 14000 },
            { name: 'Tue', actual: 11200, target: 11000 },
            { name: 'Wed', actual: 0, target: 0 },
            { name: 'Thu', actual: 15800, target: 16000 },
            { name: 'Fri', actual: 8900, target: 14000 },
            { name: 'Sat', actual: 0, target: 11000 },
            { name: 'Sun', actual: 0, target: 0 },
        ],
        muscleBalanceData: [
            { muscle: 'Chest', volume: 85, target: 100 },
            { muscle: 'Back', volume: 92, target: 100 },
            { muscle: 'Shoulders', volume: 78, target: 100 },
            { muscle: 'Quads', volume: 95, target: 100 },
            { muscle: 'Hams', volume: 70, target: 100 },
            { muscle: 'Arms', volume: 88, target: 100 },
        ],
        prs: [
            { exercise: 'Bench Press', weight: 100, reps: 5, date: '2024-01-15', rpe: 9 },
            { exercise: 'Squat', weight: 140, reps: 5, date: '2024-01-18', rpe: 9 },
            { exercise: 'Deadlift', weight: 180, reps: 3, date: '2024-01-20', rpe: 9 },
        ],
    };
};

const getDemoData = (endpoint) => {
    if (endpoint.includes('/users/profile') || endpoint === '/users/me') {
        return { data: getDemoUser() };
    }
    if (endpoint.includes('/users/stats')) {
        return { data: getDemoStats() };
    }
    if (endpoint.includes('/programs/current') || endpoint.includes('/programs/active')) {
        return { data: getDemoProgram() };
    }
    if (endpoint.includes('/workouts')) {
        if (endpoint.includes('/history')) {
            return { data: getDemoWorkoutHistory() };
        }
        return { data: getDemoWorkoutHistory()[0] || null };
    }
    if (endpoint.includes('/exercises')) {
        return { data: getDemoExercises() };
    }
    if (endpoint.includes('/analytics')) {
        return { data: getDemoAnalytics() };
    }
    
    console.warn(`[DEMO] No demo data for: ${endpoint}`);
    return { data: null };
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const apiRequest = async (method, endpoint, data = null, options = {}) => {
    const { retries = 0, useLocalStorage = true } = options;

    if (isDemoMode || !navigator.onLine) {
        const demoData = getDemoData(endpoint);
        return { ...demoData, fromCache: true, isDemo: true };
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await api({ method, url: endpoint, data });
            return { data: response.data, error: null, fromCache: false, isDemo: false };
        } catch (error) {
            if (attempt === retries) {
                if (useLocalStorage) {
                    const demoData = getDemoData(endpoint);
                    return { ...demoData, fromCache: true, isDemo: true };
                }
                return {
                    data: null,
                    error: error.message || 'Request failed',
                    fromCache: false,
                    isDemo: false,
                };
            }
            await delay(Math.pow(2, attempt) * 500);
        }
    }
};

export const get = (endpoint, options = {}) => apiRequest('GET', endpoint, null, options);
export const post = (endpoint, data, options = {}) => apiRequest('POST', endpoint, data, options);
export const put = (endpoint, data, options = {}) => apiRequest('PUT', endpoint, data, options);
export const del = (endpoint, options = {}) => apiRequest('DELETE', endpoint, null, options);

export const setAuthToken = (token) => {
    // Deprecated: Tokens are managed automatically by HttpOnly cookies
};

export const getAuthToken = () => {
    // Deprecated: Cannot read HttpOnly token from frontend; returns a mock value
    return localStorage.getItem('liftit_user') ? 'cookie-based' : null;
};

export const isAuthenticated = () => {
    const hasUser = localStorage.getItem('liftit_user');
    return !!hasUser || isDemoMode;
};

export default api;
