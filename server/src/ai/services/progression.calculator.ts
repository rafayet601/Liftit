import type {
  FitnessLevel,
  SetPerformance,
  ExerciseHistory,
  ProgressionRecommendation,
  MeasurementUnit,
} from '../types/index.js';

export interface ProgressionConfig {
  level: FitnessLevel;
  unit: MeasurementUnit;
  targetRPE?: number;
  repRange?: { min: number; max: number };
  currentWeight: number;
  currentReps: number;
}

const PROGRESSION_RATES = {
  beginner: { min: 0.025, max: 0.05 },
  intermediate: { min: 0.01, max: 0.025 },
  advanced: { min: 0.005, max: 0.01 },
};

const RPE_THRESHOLDS = {
  too_easy: 7,
  maintain: 8,
  at_limit: 9,
};

export const calculate1RM = (weight: number, reps: number): number => {
  if (reps === 1) return weight;
  if (reps <= 0 || weight <= 0) return 0;
  return Math.round(weight * (1 + reps / 30));
};

export const estimateWeightFrom1RM = (oneRM: number, targetReps: number): number => {
  if (targetReps === 1) return oneRM;
  if (targetReps <= 0 || oneRM <= 0) return 0;
  return Math.round(oneRM / (1 + targetReps / 30) * 10) / 10;
};

export const calculateTotalVolume = (sets: SetPerformance[]): number => {
  return sets.reduce((total, set) => total + set.weight * set.reps, 0);
};

export const calculateAverageRPE = (sets: SetPerformance[]): number => {
  const setsWithRPE = sets.filter(s => s.rpe !== undefined && s.rpe !== null);
  if (setsWithRPE.length === 0) return 0;
  const totalRPE = setsWithRPE.reduce((sum, set) => sum + (set.rpe || 0), 0);
  return Math.round((totalRPE / setsWithRPE.length) * 10) / 10;
};

export const calculateVolumePerMuscleGroup = (
  exerciseHistory: ExerciseHistory[],
  muscleGroup: string,
  weeks: number = 1
): number => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - weeks * 7);

  let totalSets = 0;
  
  for (const history of exerciseHistory) {
    const relevantSets = history.sets.filter(
      s => new Date(s.date) >= cutoffDate
    );
    totalSets += relevantSets.length;
  }

  return totalSets;
};

export const getVolumeLandmark = (setsPerWeek: number): {
  category: 'maintenance' | 'moderate' | 'high' | 'excessive';
  description: string;
} => {
  if (setsPerWeek < 6) {
    return { category: 'maintenance', description: 'Minimum effective dose for maintenance' };
  }
  if (setsPerWeek >= 6 && setsPerWeek < 12) {
    return { category: 'maintenance', description: 'Adequate for maintenance, slight growth possible' };
  }
  if (setsPerWeek >= 12 && setsPerWeek < 20) {
    return { category: 'moderate', description: 'Optimal hypertrophy range' };
  }
  if (setsPerWeek >= 20 && setsPerWeek < 30) {
    return { category: 'high', description: 'High volume, significant growth stimulus' };
  }
  return { category: 'excessive', description: 'Excessive volume, consider deload' };
};

export const calculateProgression = (
  history: ExerciseHistory,
  config: ProgressionConfig
): ProgressionRecommendation => {
  const { level, unit, currentWeight, currentReps, targetRPE = 8 } = config;

  const recentSets = history.sets.slice(0, 10);
  const averageWeight = recentSets.reduce((sum, s) => sum + s.weight, 0) / recentSets.length;
  const averageReps = recentSets.reduce((sum, s) => sum + s.reps, 0) / recentSets.length;
  const averageRPE = calculateAverageRPE(recentSets);

  const estimated1RM = calculate1RM(currentWeight, currentReps);
  const recent1RM = calculate1RM(averageWeight, Math.round(averageReps));

  const progressionRate = PROGRESSION_RATES[level];
  const defaultProgression = (progressionRate.min + progressionRate.max) / 2;

  let recommendedWeight = currentWeight;
  let recommendedReps = currentReps;
  let recommendedRPE = targetRPE;
  let reason = '';
  let deloadRecommended = false;

  if (recentSets.length >= 3) {
    if (averageRPE < RPE_THRESHOLDS.too_easy) {
      const increasePercent = progressionRate.max;
      recommendedWeight = Math.round((currentWeight * (1 + increasePercent)) / 2.5) * 2.5;
      recommendedReps = currentReps;
      reason = `RPE ${averageRPE} suggests room for more load. Increasing weight by ${(increasePercent * 100).toFixed(1)}%.`;
    } else if (averageRPE >= RPE_THRESHOLDS.too_easy && averageRPE < RPE_THRESHOLDS.maintain) {
      recommendedWeight = currentWeight;
      recommendedReps = Math.min(currentReps + 1, currentReps + 2);
      reason = `RPE ${averageRPE} is in the sweet spot. Aim for +1 rep next session.`;
    } else if (averageRPE >= RPE_THRESHOLDS.maintain && averageRPE < RPE_THRESHOLDS.at_limit) {
      recommendedWeight = currentWeight;
      recommendedReps = currentReps;
      reason = `RPE ${averageRPE} is appropriate. Maintain current load and focus on form.`;
    } else {
      const decreasePercent = 0.05 + (averageRPE - RPE_THRESHOLDS.at_limit) * 0.05;
      recommendedWeight = Math.round((currentWeight * (1 - decreasePercent)) / 2.5) * 2.5;
      recommendedReps = currentReps;
      deloadRecommended = true;
      reason = `RPE ${averageRPE} indicates overreaching. Reduce weight by ${(decreasePercent * 100).toFixed(1)}% for recovery.`;
    }
  } else {
    recommendedWeight = Math.round((currentWeight * (1 + defaultProgression)) / 2.5) * 2.5;
    reason = `Limited history. Using standard ${(defaultProgression * 100).toFixed(1)}% progression for ${level}.`;
  }

  if (unit === 'lbs') {
    recommendedWeight = Math.round(recommendedWeight / 2.5) * 2.5;
  }

  return {
    exerciseId: history.exerciseId,
    exerciseName: history.exerciseName,
    currentWeight,
    currentReps,
    currentRPE: averageRPE || undefined,
    recommendedWeight,
    recommendedReps,
    recommendedRPE,
    progressionRate: defaultProgression,
    reason,
    deloadRecommended,
  };
};

export const applyDoubleProgression = (
  currentWeight: number,
  currentReps: number,
  repRange: { min: number; max: number },
  performance: 'easy' | 'moderate' | 'hard'
): { newWeight: number; newReps: number; description: string } => {
  if (performance === 'easy' && currentReps >= repRange.max) {
    const newWeight = Math.round((currentWeight * 1.025) / 2.5) * 2.5;
    return {
      newWeight,
      newReps: repRange.min,
      description: `Top of rep range achieved! Increase weight to ${newWeight} and reset to ${repRange.min} reps.`,
    };
  }

  if (performance === 'hard' && currentReps <= repRange.min) {
    const newWeight = Math.round((currentWeight * 0.9) / 2.5) * 2.5;
    return {
      newWeight,
      newReps: currentReps,
      description: `Struggling at bottom of range. Reduce weight to ${newWeight} and rebuild.`,
    };
  }

  let newReps = currentReps;
  if (performance === 'easy') {
    newReps = Math.min(currentReps + 1, repRange.max);
  }

  return {
    newWeight: currentWeight,
    newReps,
    description: `Maintain weight at ${currentWeight}, target ${newReps} reps.`,
  };
};

export const calculateDeloadRecommendation = (
  currentWeek: number,
  level: FitnessLevel,
  performanceTrend: 'improving' | 'stable' | 'declining'
): {
  shouldDeload: boolean;
  deloadWeek: number;
  volumeReduction: number;
  intensityReduction: number;
  reason: string;
} => {
  const deloadIntervals = {
    beginner: 4,
    intermediate: 6,
    advanced: 8,
  };

  const interval = deloadIntervals[level];

  if (currentWeek % interval === 0) {
    return {
      shouldDeload: true,
      deloadWeek: currentWeek,
      volumeReduction: 0.4,
      intensityReduction: 0.1,
      reason: 'Scheduled deload week.',
    };
  }

  if (performanceTrend === 'declining') {
    return {
      shouldDeload: true,
      deloadWeek: currentWeek,
      volumeReduction: 0.3,
      intensityReduction: 0.05,
      reason: 'Performance declining - unscheduled deload recommended.',
    };
  }

  return {
    shouldDeload: false,
    deloadWeek: Math.ceil(currentWeek / interval) * interval,
    volumeReduction: 0,
    intensityReduction: 0,
    reason: 'No deload needed at this time.',
  };
};

export const calculateMesocyclePhase = (
  weekNumber: number,
  totalWeeks: number
): {
  phase: 'accumulation' | 'transmutation' | 'realization' | 'deload';
  intensity: number;
  volume: number;
  description: string;
} => {
  const phaseLength = Math.floor(totalWeeks / 4);
  
  if (weekNumber % 4 === 0 && weekNumber < totalWeeks) {
    return {
      phase: 'deload',
      intensity: 60,
      volume: 50,
      description: 'Recovery week. Reduce volume and intensity to allow supercompensation.',
    };
  }

  const adjustedWeek = ((weekNumber - 1) % 3) + 1;

  switch (adjustedWeek) {
    case 1:
      return {
        phase: 'accumulation',
        intensity: 70,
        volume: 100,
        description: 'Accumulation phase. Higher volume, moderate intensity. Building work capacity.',
      };
    case 2:
      return {
        phase: 'transmutation',
        intensity: 80,
        volume: 85,
        description: 'Transmutation phase. Increased intensity, moderate volume. Converting volume to strength.',
      };
    case 3:
      return {
        phase: 'realization',
        intensity: 90,
        volume: 70,
        description: 'Realization phase. High intensity, reduced volume. Peak performance.',
      };
    default:
      return {
        phase: 'accumulation',
        intensity: 70,
        volume: 100,
        description: 'Building base fitness.',
      };
  }
};
