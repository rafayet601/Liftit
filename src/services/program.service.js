import { get, post, put, del } from '../lib/api';
import { loadData, saveData } from '../lib/store';

const PROGRAM_ENDPOINTS = {
    programs: '/programs',
    current: '/programs/current',
    templates: '/programs/templates',
};

const getLocalProgram = () => {
    const stored = loadData();
    return stored.currentMesocycle || null;
};

export const getPrograms = async () => {
    try {
        return await get(PROGRAM_ENDPOINTS.programs);
    } catch {
        const local = getLocalProgram();
        return { data: local ? [local] : [], fromCache: true };
    }
};

export const getProgram = async (id) => {
    try {
        return await get(`${PROGRAM_ENDPOINTS.programs}/${id}`);
    } catch {
        const local = getLocalProgram();
        return { data: local?.id === id ? local : null, fromCache: true };
    }
};

export const createProgram = async (programData) => {
    const stored = loadData();
    const newProgram = {
        id: `program-${Date.now()}`,
        ...programData,
        createdAt: new Date().toISOString(),
    };
    saveData({ ...stored, currentMesocycle: { ...newProgram, active: true } });
    
    try {
        return await post(PROGRAM_ENDPOINTS.programs, newProgram);
    } catch {
        return { data: newProgram, fromCache: true };
    }
};

export const updateProgram = async (id, programData) => {
    const stored = loadData();
    if (stored.currentMesocycle?.id === id) {
        const updated = { ...stored.currentMesocycle, ...programData };
        saveData({ ...stored, currentMesocycle: updated });
    }
    
    try {
        return await put(`${PROGRAM_ENDPOINTS.programs}/${id}`, programData);
    } catch {
        return { data: programData, fromCache: true };
    }
};

export const deleteProgram = async (id) => {
    const stored = loadData();
    if (stored.currentMesocycle?.id === id) {
        saveData({ ...stored, currentMesocycle: null });
    }
    
    try {
        return await del(`${PROGRAM_ENDPOINTS.programs}/${id}`);
    } catch {
        return { data: { success: true }, fromCache: true };
    }
};

export const getActiveProgram = async () => {
    try {
        return await get(PROGRAM_ENDPOINTS.current);
    } catch {
        const stored = loadData();
        const local = getLocalProgram();
        
        if (local?.active) {
            return {
                data: {
                    id: local.id || 'local-program',
                    name: local.name || 'Local Program',
                    isActive: true,
                    mesocycle: {
                        phase: local.focus || 'Hypertrophy',
                        weeks: local.weeks || 6,
                        currentWeek: local.currentWeek || 1,
                    },
                    programDays: getDemoProgramDays(),
                },
                fromCache: true
            };
        }
        return { data: null, fromCache: true };
    }
};

const getDemoProgramDays = () => [
    { id: 'day-1', name: 'Push A', dayOfWeek: 1, exercises: [
        { id: 'ex-1', exercise: { name: 'Bench Press' }, targetSets: 4, targetReps: '8-10' },
        { id: 'ex-2', exercise: { name: 'Overhead Press' }, targetSets: 3, targetReps: '8-12' },
        { id: 'ex-3', exercise: { name: 'Incline DB Press' }, targetSets: 3, targetReps: '10-12' },
        { id: 'ex-4', exercise: { name: 'Lateral Raises' }, targetSets: 4, targetReps: '12-15' },
    ]},
    { id: 'day-2', name: 'Pull A', dayOfWeek: 2, exercises: [
        { id: 'ex-5', exercise: { name: 'Deadlift' }, targetSets: 4, targetReps: '5-6' },
        { id: 'ex-6', exercise: { name: 'Barbell Rows' }, targetSets: 4, targetReps: '8-10' },
        { id: 'ex-7', exercise: { name: 'Pull-ups' }, targetSets: 3, targetReps: '8-12' },
        { id: 'ex-8', exercise: { name: 'Face Pulls' }, targetSets: 3, targetReps: '15-20' },
    ]},
    { id: 'day-3', name: 'Rest', dayOfWeek: 3, exercises: [] },
    { id: 'day-4', name: 'Legs A', dayOfWeek: 4, exercises: [
        { id: 'ex-9', exercise: { name: 'Squat' }, targetSets: 4, targetReps: '6-8' },
        { id: 'ex-10', exercise: { name: 'Romanian Deadlift' }, targetSets: 3, targetReps: '8-10' },
        { id: 'ex-11', exercise: { name: 'Leg Press' }, targetSets: 3, targetReps: '10-12' },
        { id: 'ex-12', exercise: { name: 'Calf Raises' }, targetSets: 4, targetReps: '12-15' },
    ]},
    { id: 'day-5', name: 'Push B', dayOfWeek: 5, exercises: [
        { id: 'ex-13', exercise: { name: 'Incline Bench' }, targetSets: 4, targetReps: '8-10' },
        { id: 'ex-14', exercise: { name: 'Dumbbell Press' }, targetSets: 3, targetReps: '10-12' },
        { id: 'ex-15', exercise: { name: 'Tricep Pushdowns' }, targetSets: 3, targetReps: '10-12' },
        { id: 'ex-16', exercise: { name: 'Overhead Tricep Ext' }, targetSets: 3, targetReps: '12-15' },
    ]},
    { id: 'day-6', name: 'Pull B', dayOfWeek: 6, exercises: [
        { id: 'ex-17', exercise: { name: 'Lat Pulldown' }, targetSets: 4, targetReps: '10-12' },
        { id: 'ex-18', exercise: { name: 'Cable Rows' }, targetSets: 4, targetReps: '10-12' },
        { id: 'ex-19', exercise: { name: 'Bicep Curls' }, targetSets: 3, targetReps: '12-15' },
        { id: 'ex-20', exercise: { name: 'Hammer Curls' }, targetSets: 3, targetReps: '12-15' },
    ]},
    { id: 'day-7', name: 'Rest', dayOfWeek: 0, exercises: [] },
];

export const setActiveProgram = async (id) => {
    const stored = loadData();
    if (stored.currentMesocycle?.id === id) {
        saveData({ ...stored, currentMesocycle: { ...stored.currentMesocycle, active: true } });
    }
    
    try {
        return await put(`${PROGRAM_ENDPOINTS.programs}/${id}/activate`);
    } catch {
        return { data: { success: true }, fromCache: true };
    }
};

export const getProgramTemplates = async () => {
    try {
        return await get(PROGRAM_ENDPOINTS.templates);
    } catch {
        return {
            data: [
                { id: 'template-1', name: 'Push/Pull/Legs', description: '6-day split' },
                { id: 'template-2', name: 'Upper/Lower', description: '4-day split' },
                { id: 'template-3', name: 'Full Body', description: '3-day split' },
            ],
            fromCache: true
        };
    }
};

export const generateProgram = async (params) => {
    const stored = loadData();
    const newProgram = {
        id: `program-${Date.now()}`,
        name: `${params.focus || 'Training'} Block`,
        active: true,
        weeks: 6,
        currentWeek: 1,
        daysPerWeek: params.days || 4,
        focus: params.focus || 'Hypertrophy',
        experience: params.experience || 'Intermediate',
        startDate: new Date().toISOString(),
        phases: [
            { name: 'Accumulation', weeks: 2 },
            { name: 'Intensification', weeks: 2 },
            { name: 'Realization', weeks: 1 },
            { name: 'Deload', weeks: 1 },
        ],
    };
    saveData({ ...stored, currentMesocycle: newProgram });
    
    try {
        return await post(`${PROGRAM_ENDPOINTS.programs}/generate`, params);
    } catch {
        return { data: newProgram, fromCache: true };
    }
};

export default {
    getPrograms,
    getProgram,
    createProgram,
    updateProgram,
    deleteProgram,
    getActiveProgram,
    setActiveProgram,
    getProgramTemplates,
    generateProgram,
};
