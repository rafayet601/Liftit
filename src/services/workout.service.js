import { get, post, put, del } from '../lib/api';
import { loadData, saveData } from '../lib/store';

const WORKOUT_ENDPOINTS = {
    workouts: '/workouts',
    active: '/workouts/active',
    history: '/workouts/history',
};

const getLocalLogs = () => {
    const stored = loadData();
    return stored.logs || [];
};

export const getWorkouts = async (params = {}) => {
    try {
        const queryString = new URLSearchParams(params).toString();
        return await get(`${WORKOUT_ENDPOINTS.workouts}${queryString ? `?${queryString}` : ''}`);
    } catch {
        return { data: getLocalLogs(), fromCache: true };
    }
};

export const getWorkout = async (id) => {
    try {
        return await get(`${WORKOUT_ENDPOINTS.workouts}/${id}`);
    } catch {
        const logs = getLocalLogs();
        const workout = logs.find(l => l.id === id || l.date === id);
        return { data: workout || null, fromCache: true };
    }
};

export const createWorkout = async (workoutData) => {
    const stored = loadData();
    const newLog = {
        id: `workout-${Date.now()}`,
        ...workoutData,
        date: new Date().toISOString(),
    };
    const logs = [...(stored.logs || []), newLog];
    saveData({ ...stored, logs });
    
    try {
        return await post(WORKOUT_ENDPOINTS.workouts, newLog);
    } catch {
        return { data: newLog, fromCache: true };
    }
};

export const updateWorkout = async (id, workoutData) => {
    const stored = loadData();
    const logs = (stored.logs || []).map(log => 
        log.id === id || log.date === id ? { ...log, ...workoutData } : log
    );
    saveData({ ...stored, logs });
    
    try {
        return await put(`${WORKOUT_ENDPOINTS.workouts}/${id}`, workoutData);
    } catch {
        return { data: workoutData, fromCache: true };
    }
};

export const deleteWorkout = async (id) => {
    const stored = loadData();
    const logs = (stored.logs || []).filter(log => log.id !== id && log.date !== id);
    saveData({ ...stored, logs });
    
    try {
        return await del(`${WORKOUT_ENDPOINTS.workouts}/${id}`);
    } catch {
        return { data: { success: true }, fromCache: true };
    }
};

export const getActiveWorkout = async () => {
    try {
        return await get(WORKOUT_ENDPOINTS.active);
    } catch {
        return { data: null, fromCache: true };
    }
};

export const getWorkoutHistory = async (limit = 50) => {
    try {
        return await get(`${WORKOUT_ENDPOINTS.history}?limit=${limit}`);
    } catch {
        const logs = getLocalLogs().slice(0, limit);
        return { data: logs, fromCache: true };
    }
};

export const logSet = async (workoutId, exerciseId, setData) => {
    const stored = loadData();
    const logs = (stored.logs || []).map(log => {
        if (log.id === workoutId || log.date === workoutId) {
            const workout = { ...log.workout };
            const exerciseIndex = workout.findIndex(ex => ex.id === exerciseId);
            if (exerciseIndex >= 0) {
                workout[exerciseIndex] = {
                    ...workout[exerciseIndex],
                    sets: [...(workout[exerciseIndex].sets || []), setData],
                };
            }
            return { ...log, workout };
        }
        return log;
    });
    saveData({ ...stored, logs });
    
    try {
        return await post(`${WORKOUT_ENDPOINTS.workouts}/${workoutId}/exercises/${exerciseId}/sets`, setData);
    } catch {
        return { data: setData, fromCache: true };
    }
};

export const completeWorkout = async (workoutId) => {
    const stored = loadData();
    const logs = (stored.logs || []).map(log => {
        if (log.id === workoutId || log.date === workoutId) {
            return { ...log, isCompleted: true, completedAt: new Date().toISOString() };
        }
        return log;
    });
    saveData({ ...stored, logs });
    
    try {
        return await post(`${WORKOUT_ENDPOINTS.workouts}/${workoutId}/complete`);
    } catch {
        return { data: { success: true }, fromCache: true };
    }
};

export default {
    getWorkouts,
    getWorkout,
    createWorkout,
    updateWorkout,
    deleteWorkout,
    getActiveWorkout,
    getWorkoutHistory,
    logSet,
    completeWorkout,
};
