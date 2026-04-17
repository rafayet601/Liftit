import { claudeService, mcpTools, AIProvider } from './services/claude.service.js';
import { groqService } from './services/groq.service.js';
import { generateSystemPrompt, formCueLibrary, exerciseDatabaseContext } from './prompts/system-prompt.js';
import { programGenerator } from './services/program.generator.js';
import { chatService, ChatContext } from './services/chat.service.js';
import { mesocycleEngine, MesocycleConfig, WeeklyProgram } from './services/mesocycle.engine.js';
import {
  calculate1RM,
  estimateWeightFrom1RM,
  calculateAverageRPE,
  calculateProgression,
  applyDoubleProgression,
  calculateDeloadRecommendation,
  calculateMesocyclePhase,
  getVolumeLandmark,
  ProgressionConfig,
} from './services/progression.calculator.js';
import {
  Program,
  ProgramDay,
  AdjustedProgram,
  ProgramAdjustment,
  ProgressionRecommendation,
  WeekFeedback,
  AIResponse,
  Message,
  GenerateProgramParams,
  UserProfile,
  ExerciseHistory,
  MesocycleWeek,
} from './types/index.js';
import { mcpService } from '../mcp/services/mcp.service.js';

export interface TrainerConfig {
  userId: string;
  userProfile?: UserProfile;
  conversationHistory: Message[];
  aiProvider?: AIProvider;
}

export class AITrainer {
  private userId: string;
  private userProfile: UserProfile | null = null;
  private conversationHistory: Message[] = [];
  private toolResults: Map<string, unknown> = new Map();
  private aiProvider: AIProvider;

  constructor(config: TrainerConfig) {
    this.userId = config.userId;
    this.conversationHistory = config.conversationHistory;
    this.aiProvider = config.aiProvider || (process.env.GROQ_API_KEY ? 'groq' : 'claude');
  }

  async initialize(): Promise<void> {
    try {
      this.userProfile = await this.fetchUserProfile();
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  }

  private async fetchUserProfile(): Promise<UserProfile> {
    const mcpTool = mcpTools.find(t => t.name === 'get_user_profile');
    if (!mcpTool) {
      throw new Error('get_user_profile tool not found');
    }

    const profile = await mcpService.getUserProfile(this.userId);
    
    return {
      id: profile.id,
      email: '',
      name: profile.name || undefined,
      fitnessLevel: profile.level as 'beginner' | 'intermediate' | 'advanced',
      primaryGoal: (profile.goals[0] as 'strength' | 'hypertrophy' | 'general') || 'general',
      experienceYears: profile.experience || undefined,
      preferredUnits: profile.preferredUnits === 'imperial' ? 'lbs' : 'kg',
      equipment: [],
      injuries: [],
    };
  }

  async generateProgram(params: GenerateProgramParams): Promise<Program> {
    if (!this.userProfile) {
      await this.initialize();
    }

    try {
      const program = await programGenerator.generateWithAI(
        this.userId,
        this.userProfile!,
        params
      );
      return program;
    } catch (error) {
      console.error('AI program generation failed, using template:', error);
      return programGenerator.generateFromTemplate(this.userProfile!, params);
    }
  }

  async adjustWeeklyProgram(
    week: number,
    feedback: WeekFeedback
  ): Promise<AdjustedProgram> {
    if (!this.userProfile) {
      await this.initialize();
    }

    const adjustments: ProgramAdjustment[] = [];
    const currentProgram = await mcpService.getCurrentProgram(this.userId);
    
    if (!currentProgram) {
      throw new Error('No active program found');
    }

    const weeklyProgram = await mcpService.getWeeklyProgram(this.userId, week);
    const mesocyclePhase = calculateMesocyclePhase(week, currentProgram.durationWeeks);
    const deloadCheck = calculateDeloadRecommendation(
      week,
      this.userProfile!.fitnessLevel,
      this.analyzePerformanceTrend(feedback)
    );

    for (const day of weeklyProgram) {
      for (const exercise of day.exercises) {
        const exerciseFeedback = feedback.exercisePerformances.find(
          p => p.exerciseId === exercise.exerciseId
        );

        if (!exerciseFeedback) continue;

        const adjustment = this.calculateExerciseAdjustment(
          exercise.exerciseId,
          exercise.exerciseName,
          exerciseFeedback,
          deloadCheck
        );
        
        if (adjustment) {
          adjustments.push(adjustment);
        }
      }
    }

    return {
      originalProgram: {
        name: currentProgram.name,
        goal: currentProgram.goal as 'strength' | 'hypertrophy' | 'general',
        difficulty: currentProgram.difficulty as 'beginner' | 'intermediate' | 'advanced',
        durationWeeks: currentProgram.durationWeeks,
        daysPerWeek: weeklyProgram.length,
        programDays: weeklyProgram.map(day => ({
          dayNumber: day.dayNumber,
          name: day.name,
          description: day.description || undefined,
          focus: day.focus || undefined,
          isRestDay: day.isRestDay,
          exercises: day.exercises.map(ex => ({
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            targetSets: ex.targetSets || 0,
            targetReps: ex.targetReps || '',
            targetRpe: ex.targetRpe || undefined,
            restSeconds: ex.restSeconds || undefined,
            notes: ex.notes || undefined,
          })),
        })),
        mesocycleWeeks: [],
      },
      adjustments,
      weekNumber: week,
    };
  }

  private calculateExerciseAdjustment(
    exerciseId: string,
    exerciseName: string,
    feedback: WeekFeedback['exercisePerformances'][0],
    deloadCheck: ReturnType<typeof calculateDeloadRecommendation>
  ): ProgramAdjustment | null {
    if (deloadCheck.shouldDeload) {
      return {
        dayNumber: 0,
        exerciseId,
        adjustmentType: 'volume_decrease',
        newWeight: Math.round((feedback.actualWeight * (1 - deloadCheck.intensityReduction)) / 2.5) * 2.5,
        reason: `Deload week: reducing volume and intensity for recovery. ${deloadCheck.reason}`,
      };
    }

    const rpe = feedback.actualRPE || 7;

    if (rpe < 7) {
      const increasePercent = this.userProfile!.fitnessLevel === 'beginner' ? 0.05 : 0.025;
      return {
        dayNumber: 0,
        exerciseId,
        adjustmentType: 'weight_increase',
        newWeight: Math.round((feedback.targetWeight * (1 + increasePercent)) / 2.5) * 2.5,
        newReps: String(feedback.targetReps),
        reason: `RPE ${rpe} indicates room for more load. Increasing weight by ${increasePercent * 100}%.`,
      };
    }

    if (rpe >= 7 && rpe <= 8) {
      return {
        dayNumber: 0,
        exerciseId,
        adjustmentType: 'maintain',
        newWeight: feedback.targetWeight,
        newReps: this.incrementRepRange(feedback.targetReps),
        reason: `RPE ${rpe} is appropriate. Maintain weight, aim for +1 rep next session.`,
      };
    }

    if (rpe > 8 && rpe <= 9) {
      return {
        dayNumber: 0,
        exerciseId,
        adjustmentType: 'maintain',
        newWeight: feedback.targetWeight,
        newReps: feedback.targetReps,
        reason: `RPE ${rpe} is at limit. Maintain current load and focus on form.`,
      };
    }

    const decreasePercent = 0.05 + (rpe - 9) * 0.05;
    return {
      dayNumber: 0,
      exerciseId,
      adjustmentType: 'weight_decrease',
      newWeight: Math.round((feedback.targetWeight * (1 - decreasePercent)) / 2.5) * 2.5,
      reason: `RPE ${rpe} indicates overreaching. Reduce weight by ${decreasePercent * 100}% for recovery.`,
    };
  }

  private incrementRepRange(reps: string): string {
    const match = reps.match(/(\d+)-(\d+)/);
    if (match) {
      const min = parseInt(match[1]);
      const max = parseInt(match[2]);
      return `${min}-${Math.min(max, max + 1)}`;
    }
    const num = parseInt(reps);
    if (!isNaN(num)) {
      return String(num + 1);
    }
    return reps;
  }

  private analyzePerformanceTrend(feedback: WeekFeedback): 'improving' | 'stable' | 'declining' {
    const completionRate = feedback.completedSets / (feedback.completedSets + feedback.missedSets);
    const avgRPE = feedback.averageRPE;

    if (completionRate < 0.8 || avgRPE > 9) {
      return 'declining';
    }
    if (completionRate > 0.95 && avgRPE <= 8) {
      return 'improving';
    }
    return 'stable';
  }

  async chat(message: string): Promise<AIResponse> {
    if (!this.userProfile) {
      await this.initialize();
    }

    const chatContext: ChatContext = {
      userId: this.userId,
      userProfile: this.userProfile!,
      conversationHistory: this.conversationHistory,
    };

    return chatService.processMessage(message, chatContext);
  }

  async getProgressionRecommendation(exerciseId: string): Promise<ProgressionRecommendation> {
    if (!this.userProfile) {
      await this.initialize();
    }

    const history = await mcpService.getExerciseHistory(this.userId, exerciseId, 4);
    const trends = await mcpService.getExerciseTrends(this.userId, exerciseId);
    const exercise = await mcpService.getExercise(exerciseId);

    if (history.length < 3) {
      return {
        exerciseId,
        exerciseName: exercise?.name || 'Unknown',
        currentWeight: 0,
        currentReps: 0,
        recommendedWeight: 0,
        recommendedReps: 5,
        progressionRate: 0.025,
        reason: 'Not enough data. Log more sets to get accurate recommendations.',
        deloadRecommended: false,
      };
    }

    const recentSets = history.slice(0, 10);
    const avgWeight = recentSets.reduce((sum, s) => sum + (s.weight || 0), 0) / recentSets.length;
    const avgReps = recentSets.reduce((sum, s) => sum + (s.reps || 0), 0) / recentSets.length;
    const avgRPE = calculateAverageRPE(
      recentSets.map(s => ({ exerciseId: s.exerciseId, weight: s.weight || 0, reps: s.reps || 0, rpe: s.rpe || undefined, date: new Date(s.completedAt) }))
    );

    const config: ProgressionConfig = {
      level: this.userProfile!.fitnessLevel,
      unit: this.userProfile!.preferredUnits,
      currentWeight: avgWeight,
      currentReps: Math.round(avgReps),
    };

    const historyData: ExerciseHistory = {
      exerciseId,
      exerciseName: exercise?.name || 'Unknown',
      sets: recentSets.map(s => ({
        exerciseId: s.exerciseId,
        weight: s.weight || 0,
        reps: s.reps || 0,
        rpe: s.rpe || undefined,
        date: new Date(s.completedAt),
      })),
      estimated1RM: trends.estimated1RM || 0,
      totalVolume: trends.totalVolume,
      averageRPE: avgRPE,
    };

    return calculateProgression(historyData, config);
  }

  async analyzeWorkoutPerformance(): Promise<AIResponse> {
    if (!this.userProfile) {
      await this.initialize();
    }

    const userData = await this.getUserDataForAnalysis();

    const systemPrompt = generateSystemPrompt({
      userName: this.userProfile?.name,
      userLevel: this.userProfile!.fitnessLevel,
      userGoal: this.userProfile!.primaryGoal,
      measurementUnit: this.userProfile!.preferredUnits,
      trainingAge: this.userProfile!.experienceYears || 1,
      equipment: this.userProfile!.equipment || [],
    });

    return claudeService.analyzeWorkoutPerformance(userData, systemPrompt, this.aiProvider);
  }

  // Generate mesocycle program using evidence-based engine
  generateMesocycleProgram(
    durationWeeks: number,
    daysPerWeek: number
  ): { mesocycle: MesocycleWeek[]; weeklyPrograms: WeeklyProgram[] } {
    if (!this.userProfile) {
      throw new Error('User profile not initialized');
    }

    const config: MesocycleConfig = {
      durationWeeks,
      daysPerWeek,
      focus: this.userProfile.primaryGoal,
      level: this.userProfile.fitnessLevel,
      equipment: this.userProfile.equipment,
      injuries: this.userProfile.injuries,
    };

    // Generate mesocycle structure
    const mesocycle = mesocycleEngine.generateMesocycle(config);

    // Generate weekly programs
    const weeklyPrograms: WeeklyProgram[] = [];
    for (let week = 1; week <= durationWeeks; week++) {
      const previousWeek = weeklyPrograms[week - 2];
      const weekProgram = mesocycleEngine.generateWeekProgram(week, config, previousWeek);
      weeklyPrograms.push(weekProgram);
    }

    return { mesocycle, weeklyPrograms };
  }

  // Get volume recommendations for a muscle group
  getVolumeRecommendation(muscleGroup: string, week: number) {
    if (!this.userProfile) {
      throw new Error('User profile not initialized');
    }

    const config: MesocycleConfig = {
      durationWeeks: 4,
      daysPerWeek: 4,
      focus: this.userProfile.primaryGoal,
      level: this.userProfile.fitnessLevel,
      equipment: this.userProfile.equipment,
    };

    return mesocycleEngine.calculateVolume(muscleGroup, week, config);
  }

  // Autoregulate exercise based on RPE feedback
  autoregulateExercise(
    isCompound: boolean,
    targetRPE: number,
    actualRPE: number,
    lastWeight: number,
    lastReps: number
  ) {
    return mesocycleEngine.autoregulate(isCompound, targetRPE, actualRPE, lastWeight, lastReps);
  }

  // Check if deload is needed
  checkDeloadNeed(
    weeksSinceDeload: number,
    fatigueScore: number,
    performanceTrend: 'improving' | 'plateau' | 'declining'
  ): boolean {
    if (!this.userProfile) {
      throw new Error('User profile not initialized');
    }

    return mesocycleEngine.shouldDeload(
      weeksSinceDeload,
      fatigueScore,
      performanceTrend,
      this.userProfile.fitnessLevel
    );
  }

  private async getUserDataForAnalysis() {
    const profile = await mcpService.getUserProfile(this.userId);
    const workouts = await mcpService.getWorkoutHistory(this.userId, 30);

    const exerciseHistory: ExerciseHistory[] = [];
    const exerciseIds = new Set<string>();
    
    for (const workout of workouts) {
      for (const set of workout.sets) {
        if (!exerciseIds.has(set.exerciseId)) {
          exerciseIds.add(set.exerciseId);
          const trends = await mcpService.getExerciseTrends(this.userId, set.exerciseId);
          exerciseHistory.push({
            exerciseId: set.exerciseId,
            exerciseName: set.exerciseName,
            sets: [],
            estimated1RM: trends.estimated1RM || 0,
            totalVolume: trends.totalVolume,
            averageRPE: 0,
          });
        }
      }
    }

    return {
      profile: {
        id: profile.id,
        email: '',
        name: profile.name || undefined,
        fitnessLevel: profile.level as 'beginner' | 'intermediate' | 'advanced',
        primaryGoal: (profile.goals[0] as 'strength' | 'hypertrophy' | 'general') || 'general',
        experienceYears: profile.experience || undefined,
        preferredUnits: profile.preferredUnits === 'imperial' ? 'lbs' : 'kg',
        equipment: [],
        injuries: [],
      },
      recentWorkouts: workouts.map(w => ({
        id: w.id,
        name: w.name || undefined,
        startedAt: new Date(w.startedAt),
        completedAt: w.completedAt ? new Date(w.completedAt) : undefined,
        isCompleted: w.isCompleted,
        sets: w.sets.map(s => ({
          exerciseId: s.exerciseId,
          exerciseName: s.exerciseName,
          weight: s.weight || 0,
          reps: s.reps || 0,
          rpe: s.rpe || undefined,
        })),
      })),
      exerciseHistory,
    };
  }

  addToHistory(message: Message): void {
    this.conversationHistory.push(message);
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50);
    }
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getSystemPrompt(): string {
    if (!this.userProfile) {
      throw new Error('User profile not initialized');
    }

    return generateSystemPrompt({
      userName: this.userProfile.name,
      userLevel: this.userProfile.fitnessLevel,
      userGoal: this.userProfile.primaryGoal,
      measurementUnit: this.userProfile.preferredUnits,
      trainingAge: this.userProfile.experienceYears || 1,
      injuries: this.userProfile.injuries,
      equipment: this.userProfile.equipment,
    }) + '\n\n' + formCueLibrary + '\n\n' + exerciseDatabaseContext;
  }
}

export const createTrainer = (config: TrainerConfig): AITrainer => {
  return new AITrainer(config);
};
