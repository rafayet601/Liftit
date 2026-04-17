import { prisma } from '../../prisma/lib.js';
import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().optional().nullable(),
  weight: z.number().positive().optional(),
  height: z.number().positive().optional(),
  age: z.number().int().positive().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  fitnessGoal: z.string().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const userPreferencesSchema = z.object({
  weightUnit: z.enum(['kg', 'lbs']).default('kg'),
  distanceUnit: z.enum(['km', 'mi']).default('km'),
  measurementSystem: z.enum(['metric', 'imperial']).default('metric'),
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  notifications: z.object({
    workoutReminders: z.boolean().default(true),
    progressUpdates: z.boolean().default(true),
    achievements: z.boolean().default(true),
  }).default({}),
});

export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;

export const getProfileSchema = z.object({});

export const updatePreferencesSchema = userPreferencesSchema.partial();

export const userService = {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  },

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  },

  async getPreferences(userId: string) {
    return {
      userId,
      weightUnit: 'kg',
      distanceUnit: 'km',
      measurementSystem: 'metric',
      theme: 'auto',
      notifications: {
        workoutReminders: true,
        progressUpdates: true,
        achievements: true,
      },
    };
  },

  async updatePreferences(userId: string, data: Partial<UserPreferencesInput>) {
    return {
      userId,
      ...data,
    };
  },

  async deleteAccount(userId: string) {
    await prisma.user.delete({
      where: { id: userId },
    });
  },
};
