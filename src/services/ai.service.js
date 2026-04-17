import { post, get, isInDemoMode } from '../lib/api';

const AI_ENDPOINTS = {
    chat: '/ai/chat',
    generateProgram: '/ai/generate-program',
    getProgression: '/ai/progression',
    analyzeForm: '/ai/analyze-form',
};

const DEMO_RESPONSES = [
    "Great question! Based on your current training history, I'd recommend focusing on progressive overload. Try increasing the weight by 2.5kg next session if you completed all sets at RPE 7-8.",
    "Looking at your RPE trends, your recovery seems on point. You can maintain the current weight but try to add 1-2 reps per set.",
    "For your bench press, since you've been hitting RPE 8 consistently, consider adding 2.5kg this week. Your form looks solid!",
    "Based on the principle of progressive overload, I'd suggest a small increase this week. Remember: 2.5% per week for intermediates is the sweet spot.",
    "Your volume landmarks are looking good! You're hitting around MAV (Minimum Adequate Volume). Keep up the consistent work!",
    "For your next session, focus on controlled eccentrics - 2-3 seconds on the lowering phase. This will help with both strength and muscle growth.",
    "I notice your back volume has been slightly below target. Try adding an extra set of rows or pull-ups to balance things out.",
    "Based on your training age and goals, a mesocycle of 4-6 weeks is optimal. We should be finishing up your accumulation phase soon!",
];

const getRandomDemoResponse = () => {
    return DEMO_RESPONSES[Math.floor(Math.random() * DEMO_RESPONSES.length)];
};

export const sendChatMessage = async (message, conversationHistory = []) => {
    if (isInDemoMode()) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
            data: {
                message: getRandomDemoResponse(),
                isDemo: true
            },
            fromCache: true
        };
    }
    return post(AI_ENDPOINTS.chat, {
        message,
        history: conversationHistory,
    });
};

export const generateAIContent = async (params) => {
    if (isInDemoMode()) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return {
            data: {
                program: {
                    name: `${params.focus || 'Training'} Mesocycle`,
                    daysPerWeek: params.days || 4,
                    experience: params.experience || 'Intermediate',
                    phases: [
                        { name: 'Accumulation', weeks: 2, focus: 'Volume building' },
                        { name: 'Intensification', weeks: 2, focus: 'Load increase' },
                        { name: 'Realization', weeks: 1, focus: 'Peak performance' },
                        { name: 'Deload', weeks: 1, focus: 'Recovery' },
                    ],
                    programDays: generateDemoProgramDays(params.days || 4),
                },
                isDemo: true
            },
            fromCache: true
        };
    }
    return post(AI_ENDPOINTS.generateProgram, params);
};

const generateDemoProgramDays = (days) => {
    const daysMap = {
        3: ['Full Body A', 'Full Body B', 'Rest'],
        4: ['Push', 'Pull', 'Legs', 'Rest'],
        5: ['Push A', 'Pull A', 'Legs', 'Push B', 'Pull B'],
        6: ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'],
    };
    
    return (daysMap[days] || daysMap[4]).map((name, idx) => ({
        id: `day-${idx}`,
        name,
        dayOfWeek: idx + 1,
        exercises: name === 'Rest' ? [] : [
            { id: `ex-${idx}-1`, exercise: { name: 'Compound Lift', muscle: 'Primary' }, targetSets: 4, targetReps: '6-8', targetRPE: 8 },
            { id: `ex-${idx}-2`, exercise: { name: 'Secondary Lift', muscle: 'Primary' }, targetSets: 3, targetReps: '8-10', targetRPE: 7 },
            { id: `ex-${idx}-3`, exercise: { name: 'Isolation', muscle: 'Secondary' }, targetSets: 3, targetReps: '10-12', targetRPE: 7 },
        ],
    }));
};

export const getProgressionRecommendation = async (exerciseId, history) => {
    if (isInDemoMode()) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
            data: {
                recommendation: {
                    action: 'maintain',
                    weightIncrease: 2.5,
                    reasoning: 'Demo: Based on your recent performance, maintain current weight and aim for +1 rep.',
                },
                isDemo: true
            },
            fromCache: true
        };
    }
    return post(AI_ENDPOINTS.getProgression, {
        exerciseId,
        history,
    });
};

export const analyzeForm = async (formData) => {
    if (isInDemoMode()) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
            data: {
                feedback: {
                    overall: 'Good',
                    cues: [
                        'Keep your core braced throughout the movement',
                        'Focus on full range of motion',
                        'Control the eccentric phase',
                    ],
                },
                isDemo: true
            },
            fromCache: true
        };
    }
    return post(AI_ENDPOINTS.analyzeForm, formData);
};

export default {
    sendChatMessage,
    generateAIContent,
    getProgressionRecommendation,
    analyzeForm,
};
