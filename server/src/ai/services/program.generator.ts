import { claudeService, mcpTools } from './claude.service.js';
import { generateSystemPrompt } from '../prompts/system-prompt.js';
import {
  Program,
  ProgramDay,
  MesocycleWeek,
  GenerateProgramParams,
  UserProfile,
  FitnessLevel,
  TrainingFocus,
} from '../types/index.js';
import {
  calculateMesocyclePhase,
  calculateDeloadRecommendation,
} from './progression.calculator.js';

interface ExerciseTemplate {
  name: string;
  sets: number;
  reps: string;
  rpe?: number;
  restSeconds?: number;
  notes?: string;
}

interface DayTemplate {
  name: string;
  focus: string;
  exercises: ExerciseTemplate[];
}

export const exerciseLibrary: Record<string, ExerciseTemplate[]> = {
  compound: [
    { name: 'Barbell Back Squat', sets: 4, reps: '5-6', rpe: 8, restSeconds: 180, notes: 'Focus on depth and knee tracking' },
    { name: 'Conventional Deadlift', sets: 3, reps: '5', rpe: 8, restSeconds: 240, notes: 'Hinge at hips, keep bar close' },
    { name: 'Bench Press', sets: 4, reps: '5-6', rpe: 8, restSeconds: 180, notes: 'Retract scapula, touch chest' },
    { name: 'Overhead Press', sets: 3, reps: '6-8', rpe: 8, restSeconds: 150, notes: 'Press in arc, lock out overhead' },
    { name: 'Barbell Row', sets: 4, reps: '6-8', rpe: 7, restSeconds: 150, notes: 'Pull to lower chest, squeeze lats' },
    { name: 'Pull-ups', sets: 3, reps: '6-10', rpe: 8, restSeconds: 120, notes: 'Full range, chin over bar' },
  ],
  hypertrophy: [
    { name: 'Incline Dumbbell Press', sets: 4, reps: '8-12', rpe: 8, restSeconds: 90, notes: '30-45 degree angle, upper chest focus' },
    { name: 'Cable Flyes', sets: 3, reps: '10-15', rpe: 7, restSeconds: 60, notes: 'Slight bend in elbows' },
    { name: 'Lat Pulldown', sets: 4, reps: '8-12', rpe: 7, restSeconds: 90, notes: 'Pull to upper chest, squeeze lats' },
    { name: 'Dumbbell Row', sets: 3, reps: '8-12', rpe: 7, restSeconds: 90, notes: 'Support on bench, pull to hip' },
    { name: 'Leg Press', sets: 4, reps: '10-12', rpe: 8, restSeconds: 120, notes: 'Full range, heels flat' },
    { name: 'Leg Curl', sets: 3, reps: '10-12', rpe: 7, restSeconds: 60, notes: 'Full contraction at top' },
    { name: 'Cable Tricep Pushdown', sets: 3, reps: '10-15', rpe: 7, restSeconds: 60, notes: 'Keep elbows fixed' },
    { name: 'Barbell Curl', sets: 3, reps: '10-12', rpe: 7, restSeconds: 60, notes: 'No swing, squeeze at top' },
  ],
  accessory: [
    { name: 'Lateral Raise', sets: 3, reps: '12-15', rpe: 7, restSeconds: 45, notes: 'Slight bend, raise to shoulder height' },
    { name: 'Face Pulls', sets: 3, reps: '12-15', rpe: 6, restSeconds: 45, notes: 'Pull to ears, squeeze rear delts' },
    { name: 'Calf Raise', sets: 4, reps: '12-15', rpe: 7, restSeconds: 60, notes: 'Full stretch at bottom' },
    { name: 'Hanging Leg Raise', sets: 3, reps: '10-15', rpe: 7, restSeconds: 60, notes: 'Control the descent' },
    { name: 'Plank', sets: 3, reps: '30-60s', rpe: 7, restSeconds: 60, notes: 'Maintain neutral spine' },
  ],
};

export const generateProgramStructure = (
  params: GenerateProgramParams,
  userProfile: UserProfile
): { program: Program; mesocycleWeeks: MesocycleWeek[] } => {
  const { duration, daysPerWeek, focus } = params;
  const { fitnessLevel } = userProfile;

  const mesocycleWeeks: MesocycleWeek[] = [];
  for (let week = 1; week <= duration; week++) {
    const phase = calculateMesocyclePhase(week, duration);
    const deloadCheck = calculateDeloadRecommendation(week, fitnessLevel, 'stable');
    
    mesocycleWeeks.push({
      weekNumber: week,
      phase: deloadCheck.shouldDeload ? 'deload' : phase.phase,
      intensity: deloadCheck.shouldDeload ? 60 : phase.intensity,
      volume: deloadCheck.shouldDeload ? 50 : phase.volume,
      description: deloadCheck.shouldDeload ? deloadCheck.reason : phase.description,
    });
  }

  const programDays = generateProgramDays(daysPerWeek, focus, fitnessLevel);

  const program: Program = {
    name: generateProgramName(focus, daysPerWeek, duration),
    description: generateProgramDescription(focus, fitnessLevel, daysPerWeek),
    goal: focus,
    difficulty: fitnessLevel,
    durationWeeks: duration,
    daysPerWeek,
    programDays,
    mesocycleWeeks,
  };

  return { program, mesocycleWeeks };
};

const generateProgramName = (focus: TrainingFocus, daysPerWeek: number, weeks: number): string => {
  const focusNames = {
    strength: 'Strength Builder',
    hypertrophy: 'Muscle Builder',
    general: 'Fitness Foundation',
  };

  const daySuffix = daysPerWeek === 3 ? 'Upper/Lower' : 
                    daysPerWeek === 4 ? 'Push/Pull' : 
                    daysPerWeek === 5 ? 'Body Part Split' : 'Full Body';

  return `${focusNames[focus]} ${daySuffix} - ${weeks} Week Program`;
};

const generateProgramDescription = (
  focus: TrainingFocus,
  level: FitnessLevel,
  daysPerWeek: number
): string => {
  const descriptions = {
    strength: `A ${daysPerWeek}-day strength-focused program designed for ${level} lifters. Emphasizes compound movements with progressive overload.`,
    hypertrophy: `A ${daysPerWeek}-day hypertrophy program targeting muscle growth through volume landmarks and mechanical tension.`,
    general: `A ${daysPerWeek}-day general fitness program combining strength and conditioning for overall health and athleticism.`,
  };

  return descriptions[focus];
};

const generateProgramDays = (
  daysPerWeek: number,
  focus: TrainingFocus,
  level: FitnessLevel
): ProgramDay[] => {
  const setsAndReps = getSetsAndRepsForLevel(focus, level);
  
  switch (daysPerWeek) {
    case 3:
      return generate3DayProgram(setsAndReps, focus);
    case 4:
      return generate4DayProgram(setsAndReps, focus);
    case 5:
      return generate5DayProgram(setsAndReps, focus);
    case 6:
      return generate6DayProgram(setsAndReps, focus);
    default:
      return generateFullBodyProgram(setsAndReps, focus, daysPerWeek);
  }
};

const getSetsAndRepsForLevel = (
  focus: TrainingFocus,
  level: FitnessLevel
): { sets: number; reps: string; rpe: number } => {
  const configs = {
    strength: {
      beginner: { sets: 3, reps: '8-10', rpe: 7 },
      intermediate: { sets: 4, reps: '5-6', rpe: 8 },
      advanced: { sets: 5, reps: '3-5', rpe: 8 },
    },
    hypertrophy: {
      beginner: { sets: 3, reps: '10-12', rpe: 7 },
      intermediate: { sets: 4, reps: '8-12', rpe: 8 },
      advanced: { sets: 4, reps: '6-10', rpe: 8 },
    },
    general: {
      beginner: { sets: 3, reps: '10-12', rpe: 7 },
      intermediate: { sets: 3, reps: '8-12', rpe: 7 },
      advanced: { sets: 4, reps: '8-10', rpe: 7 },
    },
  };

  return configs[focus][level];
};

const generate3DayProgram = (
  setsAndReps: { sets: number; reps: string; rpe: number },
  focus: TrainingFocus
): ProgramDay[] => {
  return [
    {
      dayNumber: 1,
      name: 'Full Body A',
      focus: 'Squat, Push, Pull',
      isRestDay: false,
      exercises: [
        { exerciseName: 'Barbell Back Squat', targetSets: setsAndReps.sets, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 180 },
        { exerciseName: 'Bench Press', targetSets: setsAndReps.sets, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 150 },
        { exerciseName: 'Barbell Row', targetSets: setsAndReps.sets, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 150 },
      ],
    },
    {
      dayNumber: 2,
      name: 'Full Body B',
      focus: 'Hinge, Push, Pull',
      isRestDay: false,
      exercises: [
        { exerciseName: 'Conventional Deadlift', targetSets: setsAndReps.sets, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 240 },
        { exerciseName: 'Overhead Press', targetSets: setsAndReps.sets, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 150 },
        { exerciseName: 'Lat Pulldown', targetSets: setsAndReps.sets, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 120 },
      ],
    },
    {
      dayNumber: 3,
      name: 'Full Body C',
      focus: 'Squat, Row, Accessory',
      isRestDay: false,
      exercises: [
        { exerciseName: 'Leg Press', targetSets: setsAndReps.sets, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 150 },
        { exerciseName: 'Dumbbell Row', targetSets: setsAndReps.sets, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 120 },
        { exerciseName: 'Dumbbell Shoulder Press', targetSets: 3, targetReps: '10-12', targetRpe: 7, restSeconds: 90 },
        { exerciseName: 'Face Pulls', targetSets: 3, targetReps: '12-15', targetRpe: 6, restSeconds: 60 },
      ],
    },
  ];
};

const generate4DayProgram = (
  setsAndReps: { sets: number; reps: string; rpe: number },
  focus: TrainingFocus
): ProgramDay[] => {
  return [
    {
      dayNumber: 1,
      name: 'Push Day',
      focus: 'Chest, Shoulders, Triceps',
      isRestDay: false,
      exercises: [
        { exerciseName: 'Bench Press', targetSets: setsAndReps.sets + 1, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 180 },
        { exerciseName: 'Overhead Press', targetSets: setsAndReps.sets, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 150 },
        { exerciseName: 'Incline Dumbbell Press', targetSets: 3, targetReps: '10-12', targetRpe: 7, restSeconds: 90 },
        { exerciseName: 'Lateral Raise', targetSets: 3, targetReps: '12-15', targetRpe: 7, restSeconds: 45 },
        { exerciseName: 'Tricep Pushdown', targetSets: 3, targetReps: '10-15', targetRpe: 7, restSeconds: 60 },
      ],
    },
    {
      dayNumber: 2,
      name: 'Pull Day',
      focus: 'Back, Biceps',
      isRestDay: false,
      exercises: [
        { exerciseName: 'Barbell Row', targetSets: setsAndReps.sets + 1, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 150 },
        { exerciseName: 'Pull-ups', targetSets: setsAndReps.sets, targetReps: '6-10', targetRpe: setsAndReps.rpe, restSeconds: 120 },
        { exerciseName: 'Lat Pulldown', targetSets: 3, targetReps: '10-12', targetRpe: 7, restSeconds: 90 },
        { exerciseName: 'Face Pulls', targetSets: 3, targetReps: '12-15', targetRpe: 6, restSeconds: 60 },
        { exerciseName: 'Barbell Curl', targetSets: 3, targetReps: '10-12', targetRpe: 7, restSeconds: 60 },
      ],
    },
    {
      dayNumber: 3,
      name: 'Leg Day A',
      focus: 'Quads, Hamstrings',
      isRestDay: false,
      exercises: [
        { exerciseName: 'Barbell Back Squat', targetSets: setsAndReps.sets + 1, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 180 },
        { exerciseName: 'Romanian Deadlift', targetSets: setsAndReps.sets, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 150 },
        { exerciseName: 'Leg Extension', targetSets: 3, targetReps: '10-12', targetRpe: 7, restSeconds: 60 },
        { exerciseName: 'Leg Curl', targetSets: 3, targetReps: '10-12', targetRpe: 7, restSeconds: 60 },
        { exerciseName: 'Calf Raise', targetSets: 4, targetReps: '12-15', targetRpe: 7, restSeconds: 60 },
      ],
    },
    {
      dayNumber: 4,
      name: 'Upper Body',
      focus: 'Full Upper Body',
      isRestDay: false,
      exercises: [
        { exerciseName: 'Dumbbell Row', targetSets: 3, targetReps: '10-12', targetRpe: 7, restSeconds: 90 },
        { exerciseName: 'Incline Dumbbell Press', targetSets: 3, targetReps: '10-12', targetRpe: 7, restSeconds: 90 },
        { exerciseName: 'Cable Flyes', targetSets: 3, targetReps: '10-15', targetRpe: 7, restSeconds: 60 },
        { exerciseName: 'Dumbbell Curl', targetSets: 3, targetReps: '10-12', targetRpe: 7, restSeconds: 60 },
        { exerciseName: 'Overhead Tricep Extension', targetSets: 3, targetReps: '10-15', targetRpe: 7, restSeconds: 60 },
      ],
    },
  ];
};

const generate5DayProgram = (
  setsAndReps: { sets: number; reps: string; rpe: number },
  focus: TrainingFocus
): ProgramDay[] => {
  return [
    {
      dayNumber: 1,
      name: 'Chest Day',
      focus: 'Chest',
      isRestDay: false,
      exercises: [
        { exerciseName: 'Bench Press', targetSets: setsAndReps.sets + 1, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 180 },
        { exerciseName: 'Incline Dumbbell Press', targetSets: setsAndReps.sets, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 150 },
        { exerciseName: 'Cable Flyes', targetSets: 3, targetReps: '12-15', targetRpe: 7, restSeconds: 90 },
        { exerciseName: 'Push-ups', targetSets: 3, targetReps: '15-20', targetRpe: 7, restSeconds: 60 },
      ],
    },
    {
      dayNumber: 2,
      name: 'Back Day',
      focus: 'Back',
      isRestDay: false,
      exercises: [
        { exerciseName: 'Barbell Row', targetSets: setsAndReps.sets + 1, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 180 },
        { exerciseName: 'Pull-ups', targetSets: setsAndReps.sets, targetReps: '6-10', targetRpe: setsAndReps.rpe, restSeconds: 120 },
        { exerciseName: 'Lat Pulldown', targetSets: 3, targetReps: '10-12', targetRpe: 7, restSeconds: 90 },
        { exerciseName: 'Seated Cable Row', targetSets: 3, targetReps: '10-12', targetRpe: 7, restSeconds: 90 },
      ],
    },
    {
      dayNumber: 3,
      name: 'Legs Day',
      focus: 'Legs',
      isRestDay: false,
      exercises: [
        { exerciseName: 'Barbell Back Squat', targetSets: setsAndReps.sets + 1, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 180 },
        { exerciseName: 'Romanian Deadlift', targetSets: setsAndReps.sets, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 150 },
        { exerciseName: 'Leg Press', targetSets: 3, targetReps: '10-12', targetRpe: 8, restSeconds: 120 },
        { exerciseName: 'Leg Curl', targetSets: 3, targetReps: '10-12', targetRpe: 7, restSeconds: 60 },
        { exerciseName: 'Calf Raise', targetSets: 4, targetReps: '12-15', targetRpe: 7, restSeconds: 60 },
      ],
    },
    {
      dayNumber: 4,
      name: 'Shoulders Day',
      focus: 'Shoulders',
      isRestDay: false,
      exercises: [
        { exerciseName: 'Overhead Press', targetSets: setsAndReps.sets + 1, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 150 },
        { exerciseName: 'Dumbbell Shoulder Press', targetSets: setsAndReps.sets, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 120 },
        { exerciseName: 'Lateral Raise', targetSets: 4, targetReps: '12-15', targetRpe: 7, restSeconds: 45 },
        { exerciseName: 'Face Pulls', targetSets: 3, targetReps: '12-15', targetRpe: 6, restSeconds: 60 },
        { exerciseName: 'Rear Delt Flyes', targetSets: 3, targetReps: '12-15', targetRpe: 7, restSeconds: 45 },
      ],
    },
    {
      dayNumber: 5,
      name: 'Arms Day',
      focus: 'Biceps, Triceps',
      isRestDay: false,
      exercises: [
        { exerciseName: 'Barbell Curl', targetSets: setsAndReps.sets, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 90 },
        { exerciseName: 'Tricep Dips', targetSets: setsAndReps.sets, targetReps: setsAndReps.reps, targetRpe: setsAndReps.rpe, restSeconds: 120 },
        { exerciseName: 'Hammer Curl', targetSets: 3, targetReps: '10-12', targetRpe: 7, restSeconds: 60 },
        { exerciseName: 'Skull Crushers', targetSets: 3, targetReps: '10-12', targetRpe: 7, restSeconds: 60 },
        { exerciseName: 'Concentration Curl', targetSets: 3, targetReps: '12-15', targetRpe: 7, restSeconds: 45 },
        { exerciseName: 'Cable Pushdown', targetSets: 3, targetReps: '12-15', targetRpe: 7, restSeconds: 45 },
      ],
    },
  ];
};

const generate6DayProgram = (
  setsAndReps: { sets: number; reps: string; rpe: number },
  focus: TrainingFocus
): ProgramDay[] => {
  const days = generate5DayProgram(setsAndReps, focus);
  days.push({
    dayNumber: 6,
    name: 'Active Recovery',
    focus: 'Mobility and Conditioning',
    isRestDay: false,
    exercises: [
      { exerciseName: 'Light Cardio', targetSets: 1, targetReps: '20-30 min', targetRpe: 5, restSeconds: 0, notes: 'Low intensity steady state' },
      { exerciseName: 'Foam Rolling', targetSets: 1, targetReps: '10-15 min', targetRpe: 4, restSeconds: 0, notes: 'Focus on trained muscle groups' },
      { exerciseName: 'Mobility Work', targetSets: 1, targetReps: '15-20 min', targetRpe: 4, restSeconds: 0, notes: 'Hip and shoulder mobility' },
    ],
  });
  return days;
};

const generateFullBodyProgram = (
  setsAndReps: { sets: number; reps: string; rpe: number },
  focus: TrainingFocus,
  daysPerWeek: number
): ProgramDay[] => {
  const days: ProgramDay[] = [];
  const exercises = [
    { name: 'Barbell Back Squat', focus: 'Squat' },
    { name: 'Bench Press', focus: 'Push' },
    { name: 'Barbell Row', focus: 'Pull' },
    { name: 'Conventional Deadlift', focus: 'Hinge' },
    { name: 'Overhead Press', focus: 'Push' },
    { name: 'Pull-ups', focus: 'Pull' },
  ];

  for (let i = 0; i < daysPerWeek; i++) {
    const dayExercises = exercises.slice(0, 4 + (i % 2));
    days.push({
      dayNumber: i + 1,
      name: `Full Body ${String.fromCharCode(65 + i)}`,
      focus: 'Full Body',
      isRestDay: false,
      exercises: dayExercises.map((ex, idx) => ({
        exerciseName: ex.name,
        targetSets: idx === 0 ? setsAndReps.sets + 1 : setsAndReps.sets,
        targetReps: setsAndReps.reps,
        targetRpe: setsAndReps.rpe,
        restSeconds: idx === 0 ? 180 : 120,
      })),
    });
  }

  return days;
};

export class ProgramGenerator {
  async generateWithAI(
    userId: string,
    userProfile: UserProfile,
    params: GenerateProgramParams
  ): Promise<Program> {
    const systemPrompt = generateSystemPrompt({
      userName: userProfile.name,
      userLevel: userProfile.fitnessLevel,
      userGoal: userProfile.primaryGoal,
      measurementUnit: userProfile.preferredUnits,
      trainingAge: userProfile.experienceYears || 1,
      injuries: params.injuries,
      equipment: params.equipment,
    });

    const userMessage = `
Generate a ${params.duration}-week ${params.focus} program for this user.

Requirements:
- ${params.daysPerWeek} training days per week
- Focus: ${params.focus}
- Available equipment: ${params.equipment.join(', ')}
- User fitness level: ${userProfile.fitnessLevel}
- User experience: ${userProfile.experienceYears || 1} years
${params.injuries ? `- Injuries/Limitations: ${params.injuries.join(', ')}` : ''}

Return a complete program with:
1. Program structure (name, description, goal, difficulty)
2. All training days with exercises, sets, reps, RPE targets, and rest periods
3. Mesocycle phases for progressive periodization

Use the exercise library as reference but feel free to suggest alternatives based on equipment and goals.
`;

    try {
      const program = await claudeService.generateStructuredResponse<Program>(
        systemPrompt,
        userMessage,
        mcpTools
      );
      return program;
    } catch (error) {
      console.error('Error generating AI program, falling back to template:', error);
      const { program } = generateProgramStructure(params, userProfile);
      return program;
    }
  }

  generateFromTemplate(
    userProfile: UserProfile,
    params: GenerateProgramParams
  ): Program {
    const { program } = generateProgramStructure(params, userProfile);
    return program;
  }
}

export const programGenerator = new ProgramGenerator();
