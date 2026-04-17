import { get, post } from '../lib/api';

const EXERCISE_ENDPOINTS = {
    exercises: '/exercises',
    muscleGroups: '/exercises/muscle-groups',
    search: '/exercises/search',
};

export const getExercises = async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return get(`${EXERCISE_ENDPOINTS.exercises}${queryString ? `?${queryString}` : ''}`);
};

export const getExercise = async (id) => {
    return get(`${EXERCISE_ENDPOINTS.exercises}/${id}`);
};

export const searchExercises = async (query) => {
    return get(`${EXERCISE_ENDPOINTS.search}?q=${encodeURIComponent(query)}`);
};

export const getExercisesByMuscleGroup = async (muscleGroup) => {
    return get(`${EXERCISE_ENDPOINTS.muscleGroups}/${encodeURIComponent(muscleGroup)}`);
};

export const getMuscleGroups = async () => {
    return get(EXERCISE_ENDPOINTS.muscleGroups);
};

export const createCustomExercise = async (exerciseData) => {
    return post(EXERCISE_ENDPOINTS.exercises, exerciseData);
};

export default {
    getExercises,
    getExercise,
    searchExercises,
    getExercisesByMuscleGroup,
    getMuscleGroups,
    createCustomExercise,
};
