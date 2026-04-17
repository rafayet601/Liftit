// Evidence-based Mesocycle Programming Engine
// Based on: Schoenfeld et al. (2017), Ralston et al. (2017), Israetel et al. (2021)

import type {
  FitnessLevel,
  TrainingFocus,
  ProgramDay,
  ExerciseSet,
  MesocycleWeek,
  Program,
} from '../types/index.js';

export interface MesocycleConfig {
  durationWeeks: number;
  daysPerWeek: number;
  focus: TrainingFocus;
  level: FitnessLevel;
  equipment?: string[];
  injuries?: string[];
}

export interface VolumeLandmark {
  mev: number;
  mav: number;
  mrv: number;
}

export interface VolumeRecommendation {
  muscleGroup: string;
  setsPerWeek: number;
  category: 'below_mev' | 'mev_to_mav' | 'mav_to_mrv' | 'above_mrv';
  adjustment: 'increase' | 'maintain' | 'decrease';
  description: string;
}

export interface AutoregulationResult {
  action: 'increase_weight' | 'increase_reps' | 'maintain' | 'decrease_weight' | 'deload';
  newWeight?: number;
  newReps?: number;
  reason: string;
}

export interface WeeklyProgram {
  weekNumber: number;
  phase: MesocycleWeek['phase'];
  days: ProgramDay[];
  totalVolume: number;
  averageIntensity: number;
}

// Volume Landmarks per muscle group per week (Israetel et al.)
const VOLUME_LANDMARKS: Record<string, VolumeLandmark> = {
  chest:    { mev: 8,  mav: 18, mrv: 26 },
  back:     { mev: 8,  mav: 22, mrv: 30 },
  shoulders:{ mev: 8,  mav: 18, mrv: 26 },
  quads:    { mev: 6,  mav: 18, mrv: 24 },
  hams:     { mev: 6,  mav: 12, mrv: 20 },
  glutes:   { mev: 6,  mav: 14, mrv: 22 },
  biceps:   { mev: 4,  mav: 14, mrv: 26 },
  triceps:  { mev: 6,  mav: 14, mrv: 22 },
  calves:   { mev: 8,  mav: 16, mrv: 24 },
  abs:      { mev: 0,  mav: 8,  mrv: 16 },
  default:  { mev: 6,  mav: 14, mrv: 22 },
};

// Progression Model based on weekly volume increase of 10-20%
const PROGRESSION_MODEL: Record<number, { volumeMultiplier: number; rpeTarget: number; phase: MesocycleWeek['phase'] }> = {
  1: { volumeMultiplier: 1.0,  rpeTarget: 7,   phase: 'accumulation' },
  2: { volumeMultiplier: 1.15, rpeTarget: 7.5, phase: 'accumulation' },
  3: { volumeMultiplier: 1.30, rpeTarget: 8,   phase: 'transmutation' },
  4: { volumeMultiplier: 1.45, rpeTarget: 8.5, phase: 'realization' },
  5: { volumeMultiplier: 0.6,  rpeTarget: 5,   phase: 'deload' },
};

// RPE-Based Autoregulation Guidelines
const RPE_GUIDELINES = {
  compound: {
    tooEasy: 7,
    optimal: { min: 7, max: 8 },
    atLimit: 9,
  },
  isolation: {
    tooEasy: 6,
    optimal: { min: 6, max: 7 },
    atLimit: 8,
  },
};

// Deload intervals based on training level
const DELOAD_INTERVALS: Record<FitnessLevel, number> = {
  beginner: 4,
  intermediate: 6,
  advanced: 8,
};

// Volume landmark getter with fallback
const getVolumeLandmark = (muscleGroup: string): VolumeLandmark => {
  const normalized = muscleGroup.toLowerCase();
  return VOLUME_LANDMARKS[normalized] || VOLUME_LANDMARKS.default;
};

// Calculate phase based on week and total duration
const calculatePhase = (
  week: number,
  totalWeeks: number
): MesocycleWeek['phase'] => {
  // Standard mesocycle: accumulation -> transmutation -> realization -> deload
  const deloadWeek = totalWeeks;
  const lastWeekBeforeDeload = totalWeeks - 1;

  if (week === deloadWeek && totalWeeks >= 4) {
    return 'deload';
  }

  const adjustedWeek = Math.min(week, lastWeekBeforeDeload);
  const phaseLength = Math.ceil(lastWeekBeforeDeload / 3);

  if (adjustedWeek <= phaseLength) return 'accumulation';
  if (adjustedWeek <= phaseLength * 2) return 'transmutation';
  return 'realization';
};

// Get volume multiplier for the current week
const getVolumeMultiplier = (week: number, totalWeeks: number): number => {
  const lastWeekBeforeDeload = totalWeeks >= 5 ? totalWeeks - 1 : totalWeeks;
  const adjustedWeek = Math.min(week, lastWeekBeforeDeload);
  const model = PROGRESSION_MODEL[adjustedWeek];
  return model?.volumeMultiplier || 1.0;
};

// Get RPE target for the current week
const getRPETarget = (week: number, totalWeeks: number): number => {
  const lastWeekBeforeDeload = totalWeeks >= 5 ? totalWeeks - 1 : totalWeeks;
  const adjustedWeek = Math.min(week, lastWeekBeforeDeload);
  const model = PROGRESSION_MODEL[adjustedWeek];
  return model?.rpeTarget || 7;
};

export class MesocycleEngine {

  // Generate a weekly program based on mesocycle phase
  generateWeekProgram(
    week: number,
    config: MesocycleConfig,
    previousWeek?: WeeklyProgram
  ): WeeklyProgram {
    const phase = calculatePhase(week, config.durationWeeks);
    const volumeMultiplier = getVolumeMultiplier(week, config.durationWeeks);
    const rpeTarget = getRPETarget(week, config.durationWeeks);

    const days: ProgramDay[] = [];
    let totalVolume = 0;

    // Calculate intensity based on phase
    const intensityMap: Record<MesocycleWeek['phase'], number> = {
      accumulation: 70,
      transmutation: 80,
      realization: 90,
      deload: 60,
    };

    const intensity = intensityMap[phase];

    // Generate training days based on split
    const daysPerWeek = config.daysPerWeek;
    const split = this.getTrainingSplit(daysPerWeek, config.focus);

    for (let dayIndex = 0; dayIndex < daysPerWeek; dayIndex++) {
      const dayConfig = split[dayIndex];
      const day: ProgramDay = {
        dayNumber: dayIndex + 1,
        name: dayConfig.name,
        description: `${phase.charAt(0).toUpperCase() + phase.slice(1)} - ${dayConfig.focus}`,
        focus: dayConfig.focus,
        isRestDay: false,
        exercises: this.generateDayExercises(
          dayConfig,
          volumeMultiplier,
          rpeTarget,
          intensity,
          config
        ),
      };

      totalVolume += day.exercises.reduce(
        (sum, ex) => sum + ex.targetSets,
        0
      );

      days.push(day);
    }

    return {
      weekNumber: week,
      phase,
      days,
      totalVolume,
      averageIntensity: intensity,
    };
  }

  // Calculate recommended volume for each muscle group
  calculateVolume(
    muscleGroup: string,
    week: number,
    config: MesocycleConfig
  ): VolumeRecommendation {
    const landmark = getVolumeLandmark(muscleGroup);
    const volumeMultiplier = getVolumeMultiplier(week, config.durationWeeks);
    const baseSets = Math.round(landmark.mav * volumeMultiplier);

    // Determine category based on landmark thresholds
    let category: VolumeRecommendation['category'];
    let adjustment: VolumeRecommendation['adjustment'];

    if (baseSets < landmark.mev) {
      category = 'below_mev';
      adjustment = 'increase';
    } else if (baseSets <= landmark.mav) {
      category = 'mev_to_mav';
      adjustment = 'maintain';
    } else if (baseSets <= landmark.mrv) {
      category = 'mav_to_mrv';
      adjustment = 'maintain';
    } else {
      category = 'above_mrv';
      adjustment = 'decrease';
    }

    const descriptions: Record<VolumeRecommendation['category'], string> = {
      below_mev: `Below minimum effective volume (${landmark.mev} sets/week). Increase volume for stimulus.`,
      mev_to_mav: `Within effective range (${landmark.mev}-${landmark.mav} sets/week). Good for growth.`,
      mav_to_mrv: `High volume range (${landmark.mav}-${landmark.mrv} sets/week). Monitor recovery.`,
      above_mrv: `Above maximum recoverable volume (${landmark.mrv} sets/week). Reduce to prevent overtraining.`,
    };

    return {
      muscleGroup,
      setsPerWeek: baseSets,
      category,
      adjustment,
      description: descriptions[category],
    };
  }

  // Autoregulate based on RPE feedback
  autoregulate(
    isCompound: boolean,
    targetRPE: number,
    actualRPE: number,
    lastWeight: number,
    lastReps: number
  ): AutoregulationResult {
    const guidelines = isCompound ? RPE_GUIDELINES.compound : RPE_GUIDELINES.isolation;

    if (actualRPE < guidelines.tooEasy) {
      const increase = isCompound ? 0.05 : 0.05;
      return {
        action: 'increase_weight',
        newWeight: Math.round((lastWeight * (1 + increase)) / 2.5) * 2.5,
        newReps: lastReps,
        reason: `RPE ${actualRPE} is too easy. Increasing weight by ${(increase * 100)}%.`,
      };
    }

    if (actualRPE >= guidelines.optimal.min && actualRPE <= guidelines.optimal.max) {
      return {
        action: 'increase_reps',
        newWeight: lastWeight,
        newReps: lastReps + 1,
        reason: `RPE ${actualRPE} is optimal. Maintaining weight, increasing reps for progression.`,
      };
    }

    if (actualRPE > guidelines.atLimit) {
      const decrease = 0.10;
      return {
        action: 'decrease_weight',
        newWeight: Math.round((lastWeight * (1 - decrease)) / 2.5) * 2.5,
        newReps: lastReps,
        reason: `RPE ${actualRPE} exceeds limits. Decreasing weight by ${(decrease * 100)}% for recovery.`,
      };
    }

    return {
      action: 'maintain',
      newWeight: lastWeight,
      newReps: lastReps,
      reason: `RPE ${actualRPE} is appropriate. Maintain current load.`,
    };
  }

  // Determine if deload is needed
  shouldDeload(
    weeksSinceDeload: number,
    fatigueScore: number,
    performanceTrend: 'improving' | 'plateau' | 'declining',
    level: FitnessLevel
  ): boolean {
    const interval = DELOAD_INTERVALS[level];

    // Scheduled deload based on interval
    if (weeksSinceDeload >= interval) {
      return true;
    }

    // Unscheduled deload based on fatigue and performance
    if (fatigueScore >= 8 && performanceTrend === 'declining') {
      return true;
    }

    if (performanceTrend === 'declining' && weeksSinceDeload >= Math.floor(interval / 2)) {
      return true;
    }

    return false;
  }

  // Generate complete mesocycle structure
  generateMesocycle(config: MesocycleConfig): MesocycleWeek[] {
    const weeks: MesocycleWeek[] = [];

    for (let i = 1; i <= config.durationWeeks; i++) {
      const phase = calculatePhase(i, config.durationWeeks);
      const volumeMultiplier = getVolumeMultiplier(i, config.durationWeeks);
      const rpeTarget = getRPETarget(i, config.durationWeeks);

      const intensityMap: Record<MesocycleWeek['phase'], number> = {
        accumulation: 70,
        transmutation: 80,
        realization: 90,
        deload: 60,
      };

      const volumeMap: Record<MesocycleWeek['phase'], number> = {
        accumulation: 100,
        transmutation: 85,
        realization: 70,
        deload: 50,
      };

      weeks.push({
        weekNumber: i,
        phase,
        intensity: intensityMap[phase],
        volume: Math.round(volumeMap[phase] * volumeMultiplier),
        description: this.getPhaseDescription(phase, i),
      });
    }

    return weeks;
  }

  // Get phase description
  private getPhaseDescription(phase: MesocycleWeek['phase'], week: number): string {
    const descriptions: Record<MesocycleWeek['phase'], string> = {
      accumulation: 'Building work capacity with higher volume and moderate intensity.',
      transmutation: 'Increasing intensity while maintaining volume. Converting hypertrophy to strength.',
      realization: 'Peak intensity, reduced volume. Testing limits and realizing gains.',
      deload: 'Recovery week. Reduced volume and intensity to allow supercompensation.',
    };
    return `Week ${week}: ${descriptions[phase]}`;
  }

  // Get training split based on days per week and focus
  private getTrainingSplit(
    daysPerWeek: number,
    focus: TrainingFocus
  ): Array<{ name: string; focus: string; muscleGroups: string[] }> {
    const splits: Record<number, Array<{ name: string; focus: string; muscleGroups: string[] }>> = {
      3: [
        { name: 'Full Body A', focus: 'Compounds', muscleGroups: ['chest', 'back', 'quads'] },
        { name: 'Full Body B', focus: 'Upper Focus', muscleGroups: ['shoulders', 'back', 'biceps', 'triceps'] },
        { name: 'Full Body C', focus: 'Lower Focus', muscleGroups: ['quads', 'hams', 'glutes', 'calves'] },
      ],
      4: [
        { name: 'Upper A', focus: 'Push/Pull', muscleGroups: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
        { name: 'Lower A', focus: 'Quad Focus', muscleGroups: ['quads', 'glutes', 'hams', 'calves', 'abs'] },
        { name: 'Upper B', focus: 'Shoulder Focus', muscleGroups: ['shoulders', 'back', 'chest', 'triceps', 'biceps'] },
        { name: 'Lower B', focus: 'Hamstring Focus', muscleGroups: ['hams', 'glutes', 'quads', 'calves', 'abs'] },
      ],
      5: [
        { name: 'Push', focus: 'Chest/Shoulders', muscleGroups: ['chest', 'shoulders', 'triceps'] },
        { name: 'Pull', focus: 'Back/Biceps', muscleGroups: ['back', 'biceps', 'rear_delts'] },
        { name: 'Legs', focus: 'Quad Dominant', muscleGroups: ['quads', 'glutes', 'calves', 'abs'] },
        { name: 'Upper', focus: 'Volume', muscleGroups: ['chest', 'back', 'shoulders', 'arms'] },
        { name: 'Lower', focus: 'Hamstring/Glute', muscleGroups: ['hams', 'glutes', 'quads', 'calves'] },
      ],
      6: [
        { name: 'Push A', focus: 'Chest Emphasis', muscleGroups: ['chest', 'shoulders', 'triceps'] },
        { name: 'Pull A', focus: 'Width Emphasis', muscleGroups: ['back', 'biceps'] },
        { name: 'Legs A', focus: 'Quad Emphasis', muscleGroups: ['quads', 'glutes', 'calves'] },
        { name: 'Push B', focus: 'Shoulder Emphasis', muscleGroups: ['shoulders', 'chest', 'triceps'] },
        { name: 'Pull B', focus: 'Thickness Emphasis', muscleGroups: ['back', 'biceps', 'rear_delts'] },
        { name: 'Legs B', focus: 'Posterior Chain', muscleGroups: ['hams', 'glutes', 'quads', 'calves', 'abs'] },
      ],
    };

    return splits[daysPerWeek] || splits[4];
  }

  // Generate exercises for a specific day
  private generateDayExercises(
    dayConfig: { name: string; focus: string; muscleGroups: string[] },
    volumeMultiplier: number,
    rpeTarget: number,
    intensity: number,
    config: MesocycleConfig
  ): ExerciseSet[] {
    const exercises: ExerciseSet[] = [];

    for (const muscleGroup of dayConfig.muscleGroups) {
      const volumeRec = this.calculateVolume(muscleGroup, 1, config);
      const setsForMuscle = Math.max(2, Math.round(volumeRec.setsPerWeek / config.daysPerWeek * volumeMultiplier));

      // Generate appropriate exercises for muscle group
      const muscleExercises = this.getExercisesForMuscle(muscleGroup, setsForMuscle, rpeTarget, config);
      exercises.push(...muscleExercises);
    }

    return exercises;
  }

  // Get exercises for a muscle group
  private getExercisesForMuscle(
    muscleGroup: string,
    targetSets: number,
    rpeTarget: number,
    config: MesocycleConfig
  ): ExerciseSet[] {
    const exerciseTemplates: Record<string, Array<{ name: string; isCompound: boolean; baseReps: string }>> = {
      chest: [
        { name: 'Bench Press', isCompound: true, baseReps: '6-8' },
        { name: 'Incline Dumbbell Press', isCompound: true, baseReps: '8-10' },
        { name: 'Cable Flyes', isCompound: false, baseReps: '10-12' },
      ],
      back: [
        { name: 'Barbell Row', isCompound: true, baseReps: '6-8' },
        { name: 'Lat Pulldown', isCompound: true, baseReps: '8-10' },
        { name: 'Seated Cable Row', isCompound: false, baseReps: '10-12' },
      ],
      shoulders: [
        { name: 'Overhead Press', isCompound: true, baseReps: '6-8' },
        { name: 'Lateral Raises', isCompound: false, baseReps: '12-15' },
        { name: 'Face Pulls', isCompound: false, baseReps: '12-15' },
      ],
      quads: [
        { name: 'Squat', isCompound: true, baseReps: '5-6' },
        { name: 'Leg Press', isCompound: true, baseReps: '8-10' },
        { name: 'Leg Extension', isCompound: false, baseReps: '10-12' },
      ],
      hams: [
        { name: 'Romanian Deadlift', isCompound: true, baseReps: '8-10' },
        { name: 'Leg Curl', isCompound: false, baseReps: '10-12' },
      ],
      glutes: [
        { name: 'Hip Thrust', isCompound: true, baseReps: '8-10' },
        { name: 'Cable Pull Through', isCompound: false, baseReps: '10-12' },
      ],
      biceps: [
        { name: 'Barbell Curl', isCompound: false, baseReps: '8-10' },
        { name: 'Incline Dumbbell Curl', isCompound: false, baseReps: '10-12' },
      ],
      triceps: [
        { name: 'Close Grip Bench Press', isCompound: true, baseReps: '8-10' },
        { name: 'Tricep Pushdown', isCompound: false, baseReps: '10-12' },
      ],
      calves: [
        { name: 'Standing Calf Raise', isCompound: false, baseReps: '10-12' },
        { name: 'Seated Calf Raise', isCompound: false, baseReps: '12-15' },
      ],
      abs: [
        { name: 'Cable Crunch', isCompound: false, baseReps: '10-15' },
        { name: 'Plank', isCompound: false, baseReps: '30-60s' },
      ],
    };

    const templates = exerciseTemplates[muscleGroup] || [];
    const exercises: ExerciseSet[] = [];

    let remainingSets = targetSets;
    for (let i = 0; i < templates.length && remainingSets > 0; i++) {
      const template = templates[i];
      const sets = Math.min(remainingSets, i === 0 ? 3 : 2);

      exercises.push({
        exerciseName: template.name,
        targetSets: sets,
        targetReps: template.baseReps,
        targetRpe: rpeTarget,
        restSeconds: template.isCompound ? 180 : 90,
        notes: template.isCompound ? 'Compound movement - focus on form' : 'Isolation - feel the muscle',
      });

      remainingSets -= sets;
    }

    return exercises;
  }
}

export const mesocycleEngine = new MesocycleEngine();
