import { prisma } from '../../../prisma/lib.js';
import { ErrorCode, McpError } from '../index.js';

export interface UserProfile {
  id: string;
  name: string | null;
  level: string;
  goals: string[];
  experience: number | null;
  preferredUnits: string;
  trainingHistory: {
    totalWorkouts: number;
    totalSets: number;
    lastWorkoutDate: string | null;
    averageWorkoutsPerWeek: number;
  };
}

export interface WorkoutLog {
  id: string;
  userId: string;
  programDayId: string | null;
  name: string | null;
  notes: string | null;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  isCompleted: boolean;
  mood: string | null;
  energy: number | null;
  sets: WorkoutSet[];
}

export interface WorkoutSet {
  id: string;
  workoutLogId: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  distance: number | null;
  duration: number | null;
  isWarmup: boolean;
  isDropSet: boolean;
  isFailure: boolean;
  notes: string | null;
  completedAt: string;
}

export interface Program {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  goal: string;
  difficulty: string;
  durationWeeks: number;
  isActive: boolean;
  isGenerated: boolean;
  mesocycleId: string | null;
  currentWeek: number | null;
}

export interface ProgramDay {
  id: string;
  programId: string;
  dayNumber: number;
  name: string;
  description: string | null;
  focus: string | null;
  isRestDay: boolean;
  exercises: ProgramDayExercise[];
}

export interface ProgramDayExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  targetSets: number | null;
  targetReps: string | null;
  targetRpe: number | null;
  restSeconds: number | null;
  notes: string | null;
}

export interface Exercise {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  instructions: string | null;
  muscleGroup: string;
  secondaryMuscles: string[];
  equipment: string | null;
  difficulty: string;
  imageUrl: string | null;
  videoUrl: string | null;
  isCompound: boolean;
  isIsolation: boolean;
  isCardio: boolean;
}

export interface ExerciseTrends {
  bestWeight: number | null;
  bestReps: number | null;
  volumeHistory: { date: string; volume: number }[];
  rpeHistory: { date: string; avgRpe: number }[];
  estimated1RM: number | null;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  strengthTrend: 'improving' | 'declining' | 'maintaining';
}

export interface ProgressionRecommendation {
  recommendedWeight: number;
  recommendedReps: number;
  reason: string;
  warnings: string[];
}

export interface PerformanceAnalysis {
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  strengthTrend: 'improving' | 'declining' | 'maintaining';
  fatigueLevel: 'low' | 'moderate' | 'high';
  recommendations: string[];
}

async function verifyUser(userId: string, shouldExist: boolean = true): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (shouldExist && !user) {
    throw new McpError(ErrorCode.InvalidParams, `User with ID ${userId} not found`);
  }

  return !!user;
}

function calculateEstimated1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  if (reps === 0 || weight === 0) return 0;
  return Math.round(weight * (1 + reps / 30));
}

function calculateSetVolume(weight: number | null, reps: number | null): number {
  if (!weight || !reps) return 0;
  return weight * reps;
}

export const mcpService = {
  async getUserProfile(userId: string): Promise<UserProfile> {
    await verifyUser(userId);

    const [user, profile, workoutStats] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, createdAt: true },
      }),
      prisma.profile.findUnique({
        where: { userId },
      }),
      prisma.workoutLog.aggregate({
        where: { userId, isCompleted: true },
        _count: { id: true },
        _sum: { duration: true },
      }),
    ]);

    const totalSets = await prisma.workoutSet.count({
      where: {
        workoutLog: { userId, isCompleted: true },
      },
    });

    const lastWorkout = await prisma.workoutLog.findFirst({
      where: { userId, isCompleted: true },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });

    const userCreatedAt = user?.createdAt || new Date();
    const weeksSinceJoin = Math.max(1, Math.ceil(
      (Date.now() - userCreatedAt.getTime()) / (7 * 24 * 60 * 60 * 1000)
    ));
    const averageWorkoutsPerWeek = Math.round((workoutStats._count.id / weeksSinceJoin) * 10) / 10;

    return {
      id: userId,
      name: user?.name || null,
      level: profile?.fitnessLevel || 'intermediate',
      goals: profile?.primaryGoal ? [profile.primaryGoal] : ['strength'],
      experience: profile?.experienceYears || null,
      preferredUnits: profile?.preferredUnits || 'imperial',
      trainingHistory: {
        totalWorkouts: workoutStats._count.id,
        totalSets,
        lastWorkoutDate: lastWorkout?.completedAt?.toISOString() || null,
        averageWorkoutsPerWeek,
      },
    };
  },

  async getWorkoutHistory(userId: string, days: number = 30): Promise<WorkoutLog[]> {
    await verifyUser(userId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const workouts = await prisma.workoutLog.findMany({
      where: {
        userId,
        startedAt: { gte: startDate },
      },
      include: {
        sets: {
          include: {
            exercise: { select: { name: true } },
          },
          orderBy: [{ exerciseId: 'asc' }, { setNumber: 'asc' }],
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    return workouts.map((w) => ({
      id: w.id,
      userId: w.userId,
      programDayId: w.programDayId,
      name: w.name,
      notes: w.notes,
      startedAt: w.startedAt.toISOString(),
      completedAt: w.completedAt?.toISOString() || null,
      duration: w.duration,
      isCompleted: w.isCompleted,
      mood: w.mood,
      energy: w.energy,
      sets: w.sets.map((s) => ({
        id: s.id,
        workoutLogId: s.workoutLogId,
        exerciseId: s.exerciseId,
        exerciseName: s.exercise.name,
        setNumber: s.setNumber,
        reps: s.reps,
        weight: s.weight,
        rpe: s.rpe,
        distance: s.distance,
        duration: s.duration,
        isWarmup: s.isWarmup,
        isDropSet: s.isDropSet,
        isFailure: s.isFailure,
        notes: s.notes,
        completedAt: s.completedAt.toISOString(),
      })),
    }));
  },

  async getExerciseHistory(userId: string, exerciseId: string, weeks: number = 4): Promise<WorkoutSet[]> {
    await verifyUser(userId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);

    const sets = await prisma.workoutSet.findMany({
      where: {
        exerciseId,
        workoutLog: { userId, startedAt: { gte: startDate } },
        isWarmup: false,
      },
      include: {
        exercise: { select: { name: true } },
      },
      orderBy: { completedAt: 'desc' },
    });

    return sets.map((s) => ({
      id: s.id,
      workoutLogId: s.workoutLogId,
      exerciseId: s.exerciseId,
      exerciseName: s.exercise.name,
      setNumber: s.setNumber,
      reps: s.reps,
      weight: s.weight,
      rpe: s.rpe,
      distance: s.distance,
      duration: s.duration,
      isWarmup: s.isWarmup,
      isDropSet: s.isDropSet,
      isFailure: s.isFailure,
      notes: s.notes,
      completedAt: s.completedAt.toISOString(),
    }));
  },

  async getExerciseTrends(userId: string, exerciseId: string): Promise<ExerciseTrends> {
    await verifyUser(userId);

    const sets = await prisma.workoutSet.findMany({
      where: {
        exerciseId,
        workoutLog: { userId, isCompleted: true },
        isWarmup: false,
      },
      include: {
        workoutLog: { select: { startedAt: true } },
      },
      orderBy: { completedAt: 'asc' },
    });

    if (sets.length === 0) {
      return {
        bestWeight: null,
        bestReps: null,
        volumeHistory: [],
        rpeHistory: [],
        estimated1RM: null,
        totalSets: 0,
        totalReps: 0,
        totalVolume: 0,
        strengthTrend: 'maintaining',
      };
    }

    const bestWeight = Math.max(...sets.filter((s) => s.weight).map((s) => s.weight as number));
    const bestReps = Math.max(...sets.filter((s) => s.reps).map((s) => s.reps as number));

    const volumeByDate = new Map<string, number>();
    const rpeByDate = new Map<string, { sum: number; count: number }>();

    let totalReps = 0;
    let totalVolume = 0;
    let maxEstimated1RM = 0;

    for (const set of sets) {
      const completedAtStr = set.completedAt instanceof Date ? set.completedAt.toISOString() : String(set.completedAt);
      const dateKey = completedAtStr.split('T')[0];
      const volume = calculateSetVolume(set.weight, set.reps);
      
      volumeByDate.set(dateKey, (volumeByDate.get(dateKey) || 0) + volume);
      
      if (set.rpe) {
        const existing = rpeByDate.get(dateKey) || { sum: 0, count: 0 };
        rpeByDate.set(dateKey, { sum: existing.sum + set.rpe, count: existing.count + 1 });
      }

      if (set.weight && set.reps) {
        totalReps += set.reps;
        totalVolume += volume;
        const e1rm = calculateEstimated1RM(set.weight, set.reps);
        if (e1rm > maxEstimated1RM) maxEstimated1RM = e1rm;
      }
    }

    const volumeHistory = Array.from(volumeByDate.entries())
      .map(([date, volume]) => ({ date, volume }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const rpeHistory = Array.from(rpeByDate.entries())
      .map(([date, data]) => ({ date, avgRpe: Math.round((data.sum / data.count) * 10) / 10 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const halfPoint = Math.floor(sets.length / 2);
    const recentHalf = sets.slice(0, halfPoint);
    const olderHalf = sets.slice(halfPoint);
    
    let strengthTrend: 'improving' | 'declining' | 'maintaining' = 'maintaining';
    if (recentHalf.length > 0 && olderHalf.length > 0) {
      const recentAvgWeight = recentHalf.filter((s) => s.weight).reduce((sum: number, s) => sum + (s.weight || 0), 0) / recentHalf.length;
      const olderAvgWeight = olderHalf.filter((s) => s.weight).reduce((sum: number, s) => sum + (s.weight || 0), 0) / olderHalf.length;
      
      if (recentAvgWeight > olderAvgWeight * 1.03) {
        strengthTrend = 'improving';
      } else if (recentAvgWeight < olderAvgWeight * 0.97) {
        strengthTrend = 'declining';
      }
    }

    return {
      bestWeight,
      bestReps,
      volumeHistory,
      rpeHistory,
      estimated1RM: maxEstimated1RM || null,
      totalSets: sets.length,
      totalReps,
      totalVolume,
      strengthTrend,
    };
  },

  async getCurrentProgram(userId: string): Promise<Program | null> {
    await verifyUser(userId);

    const program = await prisma.program.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!program) return null;

    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { activeMesocycleId: true },
    });

    const currentWeek = profile?.activeMesocycleId
      ? await this.getCurrentWeekNumber(userId)
      : null;

    return {
      id: program.id,
      userId: program.userId,
      name: program.name,
      description: program.description,
      goal: program.goal,
      difficulty: program.difficulty,
      durationWeeks: program.durationWeeks,
      isActive: program.isActive,
      isGenerated: program.isGenerated,
      mesocycleId: program.mesocycleId,
      currentWeek,
    };
  },

  async getCurrentWeekNumber(userId: string): Promise<number | null> {
    const mesocycle = await prisma.mesocycle.findFirst({
      where: { userId, isActive: true },
      select: { startDate: true, durationWeeks: true },
    });

    if (!mesocycle) return null;

    const now = new Date();
    const startDate = mesocycle.startDate;
    const weeksElapsed = Math.floor(
      (now.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );

    return Math.min(weeksElapsed + 1, mesocycle.durationWeeks);
  },

  async getWeeklyProgram(userId: string, week: number): Promise<ProgramDay[]> {
    await verifyUser(userId);

    const program = await prisma.program.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!program) {
      throw new McpError(ErrorCode.InvalidParams, 'No active program found');
    }

    if (week < 1 || week > program.durationWeeks) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Week ${week} is out of range. Program has ${program.durationWeeks} weeks.`
      );
    }

    const days = await prisma.programDay.findMany({
      where: { programId: program.id },
      include: {
        exercises: {
          include: {
            exercise: { select: { name: true } },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { dayNumber: 'asc' },
    });

    return days.map((d) => ({
      id: d.id,
      programId: d.programId,
      dayNumber: d.dayNumber,
      name: d.name,
      description: d.description,
      focus: d.focus,
      isRestDay: d.isRestDay,
      exercises: d.exercises.map((e) => ({
        id: e.id,
        exerciseId: e.exerciseId,
        exerciseName: e.exercise.name,
        order: e.order,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        targetRpe: e.targetRpe,
        restSeconds: e.restSeconds,
        notes: e.notes,
      })),
    }));
  },

  async getExercise(exerciseId: string): Promise<Exercise | null> {
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) return null;

    let secondaryMuscles: string[] = [];
    try {
      secondaryMuscles = typeof exercise.secondaryMuscles === 'string' 
        ? JSON.parse(exercise.secondaryMuscles) 
        : exercise.secondaryMuscles;
    } catch {
      secondaryMuscles = [];
    }

    return {
      id: exercise.id,
      name: exercise.name,
      slug: exercise.slug,
      description: exercise.description,
      instructions: exercise.instructions,
      muscleGroup: exercise.muscleGroup,
      secondaryMuscles,
      equipment: exercise.equipment,
      difficulty: exercise.difficulty,
      imageUrl: exercise.imageUrl,
      videoUrl: exercise.videoUrl,
      isCompound: exercise.isCompound,
      isIsolation: exercise.isIsolation,
      isCardio: exercise.isCardio,
    };
  },

  async logWorkout(input: {
    userId: string;
    name?: string;
    programDayId?: string;
    notes?: string;
    mood?: string;
    energy?: number;
    startedAt?: string;
  }): Promise<WorkoutLog> {
    await verifyUser(input.userId);

    const workout = await prisma.workoutLog.create({
      data: {
        userId: input.userId,
        name: input.name,
        programDayId: input.programDayId,
        notes: input.notes,
        mood: input.mood,
        energy: input.energy,
        startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
        isCompleted: true,
        completedAt: new Date(),
      },
      include: {
        sets: {
          include: {
            exercise: { select: { name: true } },
          },
        },
      },
    });

    return {
      id: workout.id,
      userId: workout.userId,
      programDayId: workout.programDayId,
      name: workout.name,
      notes: workout.notes,
      startedAt: workout.startedAt.toISOString(),
      completedAt: workout.completedAt?.toISOString() || null,
      duration: workout.duration,
      isCompleted: workout.isCompleted,
      mood: workout.mood,
      energy: workout.energy,
      sets: workout.sets.map((s) => ({
        id: s.id,
        workoutLogId: s.workoutLogId,
        exerciseId: s.exerciseId,
        exerciseName: s.exercise.name,
        setNumber: s.setNumber,
        reps: s.reps,
        weight: s.weight,
        rpe: s.rpe,
        distance: s.distance,
        duration: s.duration,
        isWarmup: s.isWarmup,
        isDropSet: s.isDropSet,
        isFailure: s.isFailure,
        notes: s.notes,
        completedAt: s.completedAt.toISOString(),
      })),
    };
  },

  async logSets(input: {
    userId: string;
    sets: Array<{
      workoutLogId: string;
      exerciseId: string;
      setNumber: number;
      reps?: number;
      weight?: number;
      rpe?: number;
      distance?: number;
      duration?: number;
      isWarmup?: boolean;
      isDropSet?: boolean;
      isFailure?: boolean;
      notes?: string;
    }>;
  }): Promise<WorkoutSet[]> {
    await verifyUser(input.userId);

    for (const set of input.sets) {
      const workoutLog = await prisma.workoutLog.findFirst({
        where: { id: set.workoutLogId, userId: input.userId },
      });

      if (!workoutLog) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Workout log ${set.workoutLogId} not found or does not belong to user`
        );
      }
    }

    const createdSets = await Promise.all(
      input.sets.map((setData) =>
        prisma.workoutSet.create({
          data: {
            workoutLogId: setData.workoutLogId,
            exerciseId: setData.exerciseId,
            setNumber: setData.setNumber,
            reps: setData.reps,
            weight: setData.weight,
            rpe: setData.rpe,
            distance: setData.distance,
            duration: setData.duration,
            isWarmup: setData.isWarmup || false,
            isDropSet: setData.isDropSet || false,
            isFailure: setData.isFailure || false,
            notes: setData.notes,
          },
          include: {
            exercise: { select: { name: true } },
          },
        })
      )
    );

    return createdSets.map((s) => ({
      id: s.id,
      workoutLogId: s.workoutLogId,
      exerciseId: s.exerciseId,
      exerciseName: s.exercise.name,
      setNumber: s.setNumber,
      reps: s.reps,
      weight: s.weight,
      rpe: s.rpe,
      distance: s.distance,
      duration: s.duration,
      isWarmup: s.isWarmup,
      isDropSet: s.isDropSet,
      isFailure: s.isFailure,
      notes: s.notes,
      completedAt: s.completedAt.toISOString(),
    }));
  },

  async calculateProgression(userId: string, exerciseId: string): Promise<ProgressionRecommendation> {
    await verifyUser(userId);

    const rules = await prisma.progressionRule.findUnique({
      where: { userId_exerciseId: { userId, exerciseId } },
    });

    const trends = await this.getExerciseTrends(userId, exerciseId);
    const recentSets = await prisma.workoutSet.findMany({
      where: {
        exerciseId,
        workoutLog: { userId, isCompleted: true },
        isWarmup: false,
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
    });

    const warnings: string[] = [];
    let recommendedWeight = 0;
    let recommendedReps = 5;
    let reason = 'Based on recent performance';

    if (recentSets.length < 3) {
      return {
        recommendedWeight: 0,
        recommendedReps: 5,
        reason: 'Not enough data to calculate progression. Log more sets to get recommendations.',
        warnings: ['Insufficient data for accurate progression'],
      };
    }

    const lastSessionSets = recentSets.slice(0, 5);
    const avgWeight = lastSessionSets.reduce((sum, s) => sum + (s.weight || 0), 0) / lastSessionSets.length;
    const avgReps = lastSessionSets.reduce((sum, s) => sum + (s.reps || 0), 0) / lastSessionSets.length;
    const avgRpe = lastSessionSets.reduce((sum, s) => sum + (s.rpe || 7), 0) / lastSessionSets.length;

    if (avgRpe > 9) {
      warnings.push('Average RPE is high - consider maintaining or reducing weight');
      reason = 'High fatigue detected - maintain current weight';
      recommendedWeight = avgWeight;
      recommendedReps = Math.floor(avgReps);
    } else if (avgRpe > 8) {
      const incrementPercent = rules?.incrementPercent || 2.5;
      recommendedWeight = Math.round((avgWeight * (1 + incrementPercent / 100)) / 2.5) * 2.5;
      recommendedReps = Math.floor(avgReps);
      reason = `Progressing weight by ${incrementPercent}% as RPE is appropriate`;
    } else {
      const incrementPercent = rules?.incrementPercent || 5;
      recommendedWeight = Math.round((avgWeight * (1 + incrementPercent / 100)) / 2.5) * 2.5;
      recommendedReps = Math.floor(avgReps);
      reason = `Progressing weight by ${incrementPercent}% as RPE indicates capacity for more`;
    }

    if (trends.strengthTrend === 'declining') {
      warnings.push('Strength appears to be declining - consider a deload week');
      recommendedWeight = avgWeight;
      recommendedReps = Math.floor(avgReps * 1.2);
      reason = 'Strength declining - adding reps to rebuild volume';
    }

    const maxReps = rules?.maxReps || 12;
    if (recommendedReps > maxReps) {
      recommendedReps = maxReps;
      recommendedWeight = Math.round((recommendedWeight * 1.05) / 2.5) * 2.5;
      warnings.push(`Reps capped at ${maxReps}, increasing weight instead`);
    }

    const minReps = rules?.minReps || 3;
    if (recommendedReps < minReps) {
      recommendedReps = minReps;
    }

    return {
      recommendedWeight: Math.max(0, recommendedWeight),
      recommendedReps,
      reason,
      warnings,
    };
  },

  async analyzePerformance(userId: string, exerciseId: string): Promise<PerformanceAnalysis> {
    await verifyUser(userId);

    const trends = await this.getExerciseTrends(userId, exerciseId);
    const recentSets = await prisma.workoutSet.findMany({
      where: {
        exerciseId,
        workoutLog: { userId, isCompleted: true },
        isWarmup: false,
      },
      orderBy: { completedAt: 'desc' },
      take: 20,
    });

    const recommendations: string[] = [];

    let volumeTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let strengthTrend: 'improving' | 'declining' | 'maintaining' = 'maintaining';
    let fatigueLevel: 'low' | 'moderate' | 'high' = 'moderate';

    if (recentSets.length < 4) {
      return {
        volumeTrend: 'stable',
        strengthTrend: 'maintaining',
        fatigueLevel: 'moderate',
        recommendations: ['Log more workouts to get accurate performance analysis'],
      };
    }

    const halfPoint = Math.floor(recentSets.length / 2);
    const recentHalf = recentSets.slice(0, halfPoint);
    const olderHalf = recentSets.slice(halfPoint);

    const recentVolume = recentHalf.reduce((sum, s) => sum + calculateSetVolume(s.weight, s.reps), 0);
    const olderVolume = olderHalf.reduce((sum, s) => sum + calculateSetVolume(s.weight, s.reps), 0);

    if (recentVolume > olderVolume * 1.1) {
      volumeTrend = 'increasing';
      recommendations.push('Volume is increasing - good for hypertrophy');
    } else if (recentVolume < olderVolume * 0.9) {
      volumeTrend = 'decreasing';
      recommendations.push('Volume decreasing - consider increasing training frequency or intensity');
    }

    const recentAvgWeight = recentHalf.filter((s) => s.weight).reduce((sum, s) => sum + (s.weight || 0), 0) / recentHalf.length;
    const olderAvgWeight = olderHalf.filter((s) => s.weight).reduce((sum, s) => sum + (s.weight || 0), 0) / olderHalf.length;

    if (recentAvgWeight > olderAvgWeight * 1.03) {
      strengthTrend = 'improving';
      recommendations.push('Strength is improving - consider increasing weight');
    } else if (recentAvgWeight < olderAvgWeight * 0.97) {
      strengthTrend = 'declining';
      recommendations.push('Strength declining - consider deload or technique review');
    }

    const recentAvgRpe = recentHalf.filter((s) => s.rpe).reduce((sum, s) => sum + (s.rpe || 0), 0) / recentHalf.filter((s) => s.rpe).length || 7;

    if (recentAvgRpe > 9) {
      fatigueLevel = 'high';
      recommendations.push('High fatigue detected - consider reducing volume or adding rest');
    } else if (recentAvgRpe < 7) {
      fatigueLevel = 'low';
      recommendations.push('Low fatigue - room to increase intensity');
    }

    if (trends.estimated1RM) {
      const currentE1rm = calculateEstimated1RM(
        recentHalf[0]?.weight || 0,
        recentHalf[0]?.reps || 0
      );
      if (currentE1rm > trends.estimated1RM * 0.95) {
        recommendations.push('Near personal best - peak performance!');
      }
    }

    return {
      volumeTrend,
      strengthTrend,
      fatigueLevel,
      recommendations,
    };
  },
};
