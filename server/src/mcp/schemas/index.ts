import { z } from 'zod';

/**
 * Zod schemas for MCP tool input validation
 */

/** User ID validation */
export const userIdSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

/** Days parameter for workout history */
export const daysSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  days: z.number().int().min(1).max(365).optional().default(30),
});

/** Weeks parameter for exercise history */
export const weeksSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  exerciseId: z.string().min(1, 'Exercise ID is required'),
  weeks: z.number().int().min(1).max(52).optional().default(4),
});

/** Exercise ID validation */
export const exerciseIdSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  exerciseId: z.string().min(1, 'Exercise ID is required'),
});

/** Week number parameter */
export const weekSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  week: z.number().int().min(1).max(52),
});

/** Single set input for logging */
export const setInputSchema = z.object({
  workoutLogId: z.string().min(1, 'Workout log ID is required'),
  exerciseId: z.string().min(1, 'Exercise ID is required'),
  setNumber: z.number().int().min(1),
  reps: z.number().int().min(0).optional(),
  weight: z.number().min(0).optional(),
  rpe: z.number().min(1).max(10).optional(),
  distance: z.number().min(0).optional(),
  duration: z.number().int().min(0).optional(),
  isWarmup: z.boolean().optional().default(false),
  isDropSet: z.boolean().optional().default(false),
  isFailure: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

/** Workout input for logging a workout */
export const workoutInputSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  name: z.string().optional(),
  programDayId: z.string().optional(),
  notes: z.string().optional(),
  mood: z.string().optional(),
  energy: z.number().int().min(1).max(10).optional(),
  startedAt: z.string().datetime().optional(),
});

/** Multiple sets input */
export const logSetsInputSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  sets: z.array(setInputSchema).min(1, 'At least one set is required'),
});

/** Type exports for schemas */
export type SetInput = z.infer<typeof setInputSchema>;
export type WorkoutInput = z.infer<typeof workoutInputSchema>;
export type LogSetsInput = z.infer<typeof logSetsInputSchema>;

/** Validation helpers */
export function validateUserId(data: unknown) {
  return userIdSchema.safeParse(data);
}

export function validateDays(data: unknown) {
  return daysSchema.safeParse(data);
}

export function validateWeeks(data: unknown) {
  return weeksSchema.safeParse(data);
}

export function validateExerciseId(data: unknown) {
  return exerciseIdSchema.safeParse(data);
}

export function validateWeek(data: unknown) {
  return weekSchema.safeParse(data);
}

export function validateWorkoutInput(data: unknown) {
  return workoutInputSchema.safeParse(data);
}

export function validateSetInput(data: unknown) {
  return setInputSchema.safeParse(data);
}

export function validateLogSetsInput(data: unknown) {
  return logSetsInputSchema.safeParse(data);
}
