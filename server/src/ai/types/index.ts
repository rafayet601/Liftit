export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type TrainingFocus = 'strength' | 'hypertrophy' | 'general';
export type MeasurementUnit = 'lbs' | 'kg';
export type ProgressionType = 'linear' | 'double_progression' | 'rpe_based' | 'percentage';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  fitnessLevel: FitnessLevel;
  primaryGoal: TrainingFocus;
  experienceYears?: number;
  weight?: number;
  height?: number;
  preferredUnits: MeasurementUnit;
  injuries?: string[];
  equipment: string[];
}

export interface ExerciseSet {
  exerciseId?: string;
  exerciseName: string;
  targetSets: number;
  targetReps: string;
  targetRpe?: number;
  restSeconds?: number;
  notes?: string;
}

export interface ProgramDay {
  dayNumber: number;
  name: string;
  description?: string;
  focus?: string;
  isRestDay: boolean;
  exercises: ExerciseSet[];
}

export interface Program {
  id?: string;
  name: string;
  description?: string;
  goal: TrainingFocus;
  difficulty: FitnessLevel;
  durationWeeks: number;
  daysPerWeek: number;
  programDays: ProgramDay[];
  mesocycleWeeks: MesocycleWeek[];
}

export interface MesocycleWeek {
  weekNumber: number;
  phase: 'accumulation' | 'transmutation' | 'realization' | 'deload';
  intensity: number;
  volume: number;
  description: string;
}

export interface SetPerformance {
  exerciseId: string;
  weight: number;
  reps: number;
  rpe?: number | null;
  date: Date;
}

export interface ExerciseHistory {
  exerciseId: string;
  exerciseName: string;
  sets: SetPerformance[];
  estimated1RM: number;
  totalVolume: number;
  averageRPE: number;
}

export interface WeekFeedback {
  weekNumber: number;
  completedSets: number;
  missedSets: number;
  averageRPE: number;
  averageEnergy: number;
  injuries?: string[];
  notes?: string;
  exercisePerformances: {
    exerciseId: string;
    exerciseName: string;
    targetWeight: number;
    targetReps: string;
    actualWeight: number;
    actualReps: number;
    actualRPE?: number;
    completed: boolean;
  }[];
}

export interface AdjustedProgram {
  originalProgram: Program;
  adjustments: ProgramAdjustment[];
  weekNumber: number;
}

export interface ProgramAdjustment {
  dayNumber: number;
  exerciseId: string;
  adjustmentType: 'weight_increase' | 'weight_decrease' | 'volume_increase' | 'volume_decrease' | 'maintain';
  newWeight?: number;
  newReps?: string;
  reason: string;
}

export interface ProgressionRecommendation {
  exerciseId: string;
  exerciseName: string;
  currentWeight: number;
  currentReps: number;
  currentRPE?: number;
  recommendedWeight: number;
  recommendedReps: number;
  recommendedRPE?: number;
  progressionRate: number;
  reason: string;
  deloadRecommended: boolean;
}

export interface AIResponse {
  message: string;
  type: 'answer' | 'motivation' | 'tip' | 'correction' | 'program';
  metadata?: Record<string, unknown>;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface GenerateProgramParams {
  duration: number;
  daysPerWeek: number;
  focus: TrainingFocus;
  equipment: string[];
  injuries?: string[];
  userPreferences?: {
    trainingAge?: number;
    preferredExercises?: string[];
    avoidExercises?: string[];
  };
}

export interface MCPExercise {
  id: string;
  name: string;
  slug: string;
  description?: string;
  instructions?: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  equipment?: string;
  difficulty: string;
  isCompound: boolean;
  isIsolation: boolean;
}

export interface MCPUserData {
  profile: {
    id: string;
    email?: string;
    name?: string;
    fitnessLevel: FitnessLevel;
    primaryGoal: TrainingFocus;
    experienceYears?: number;
    preferredUnits: MeasurementUnit | string;
    injuries?: string[];
    equipment: string[];
  };
  recentWorkouts: {
    id: string;
    name?: string;
    startedAt: Date;
    completedAt?: Date;
    isCompleted: boolean;
    sets: {
      exerciseId: string;
      exerciseName: string;
      weight: number;
      reps: number;
      rpe?: number | null;
    }[];
  }[];
  exerciseHistory: ExerciseHistory[];
}
