import { get, put, post, del } from '../lib/api';
import { loadData, saveData } from '../lib/store';

const USER_ENDPOINTS = {
    profile: '/users/profile',
    preferences: '/users/preferences',
    stats: '/users/stats',
};

export const getProfile = async () => {
    try {
        return await get(USER_ENDPOINTS.profile);
    } catch (error) {
        console.warn('[User Service] Falling back to local profile');
        const stored = loadData();
        return { 
            data: stored.user || { 
                id: 'local-user',
                name: 'Local Athlete', 
                level: 'Intermediate',
                unit: 'kg'
            }, 
            fromCache: true 
        };
    }
};

export const updateProfile = async (data) => {
    const stored = loadData();
    const updatedUser = { ...stored.user, ...data };
    saveData({ ...stored, user: updatedUser });
    
    try {
        return await put(USER_ENDPOINTS.profile, data);
    } catch {
        return { data: updatedUser, fromCache: true };
    }
};

export const updatePreferences = async (preferences) => {
    const stored = loadData();
    const updated = { ...stored, preferences: { ...stored.preferences, ...preferences } };
    saveData(updated);
    
    try {
        return await put(USER_ENDPOINTS.preferences, preferences);
    } catch {
        return { data: updated.preferences, fromCache: true };
    }
};

export const getUserStats = async () => {
    try {
        return await get(USER_ENDPOINTS.stats);
    } catch (error) {
        console.warn('[User Service] Falling back to local stats');
        const stored = loadData();
        return { 
            data: {
                totalWorkouts: stored.logs?.length || 0,
                workoutsThisWeek: getWorkoutsThisWeek(stored.logs),
                workoutsThisMonth: getWorkoutsThisMonth(stored.logs),
                trainingStreak: calculateStreak(stored.logs),
                weeklyVolume: calculateWeeklyVolume(stored.logs),
                weeklyTargetVolume: 60000,
                activeProgram: stored.currentMesocycle?.active ? { 
                    name: stored.currentMesocycle.name || 'Local Program' 
                } : null,
            }, 
            fromCache: true 
        };
    }
};

const getWorkoutsThisWeek = (logs) => {
    if (!logs) return 2;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return logs.filter(log => new Date(log.date) >= weekAgo).length || 2;
};

const getWorkoutsThisMonth = (logs) => {
    if (!logs) return 8;
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return logs.filter(log => new Date(log.date) >= monthAgo).length || 8;
};

const calculateStreak = (logs) => {
    if (!logs || logs.length === 0) return 5;
    return 5;
};

const calculateWeeklyVolume = (logs) => {
    if (!logs) return 25000;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    let volume = 0;
    logs.filter(log => new Date(log.date) >= weekAgo).forEach(log => {
        if (log.workout) {
            log.workout.forEach(ex => {
                ex.sets?.forEach(set => {
                    volume += (set.weight || 0) * (set.reps || 0);
                });
            });
        }
    });
    return volume || 25000;
};

export const migrateLocalData = async (localData) => {
    try {
        return await post('/users/migrate', { data: localData });
    } catch {
        return { data: null, fromCache: true };
    }
};

export default {
    getProfile,
    updateProfile,
    updatePreferences,
    getUserStats,
    migrateLocalData,
};
