import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, JwtPayload } from '../../middleware/auth.js';
import { validate } from '../../middleware/error.js';
import { AITrainer, createTrainer } from '../trainer.js';
import {
  Program,
  Message,
  AIResponse,
  GenerateProgramParams,
} from '../types/index.js';

const router = Router();

router.use(authenticate);

const generateProgramSchema = z.object({
  duration: z.number().int().min(1).max(16),
  daysPerWeek: z.number().int().min(1).max(6),
  focus: z.enum(['strength', 'hypertrophy', 'general']),
  equipment: z.array(z.string()).min(1),
  injuries: z.array(z.string()).optional(),
  userPreferences: z.object({
    trainingAge: z.number().optional(),
    preferredExercises: z.array(z.string()).optional(),
    avoidExercises: z.array(z.string()).optional(),
  }).optional(),
});

const adjustProgramSchema = z.object({
  week: z.number().int().min(1),
  feedback: z.object({
    weekNumber: z.number(),
    completedSets: z.number(),
    missedSets: z.number(),
    averageRPE: z.number().min(1).max(10),
    averageEnergy: z.number().min(1).max(10).default(7),
    injuries: z.array(z.string()).optional(),
    notes: z.string().optional(),
    exercisePerformances: z.array(z.object({
      exerciseId: z.string(),
      exerciseName: z.string(),
      targetWeight: z.number(),
      targetReps: z.string(),
      actualWeight: z.number(),
      actualReps: z.number(),
      actualRPE: z.number().min(1).max(10).optional(),
      completed: z.boolean(),
    })),
  }),
});

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    timestamp: z.string().optional(),
  })).optional(),
});

const analyzeSchema = z.object({
  exerciseId: z.string().optional(),
  workoutId: z.string().optional(),
  timeframe: z.enum(['week', 'month', 'all']).optional(),
});

const trainers: Map<string, AITrainer> = new Map();

function getOrCreateTrainer(userId: string, history?: Message[]): AITrainer {
  if (!trainers.has(userId)) {
    trainers.set(userId, createTrainer({
      userId,
      conversationHistory: history || [],
    }));
  }
  return trainers.get(userId)!;
}

router.post('/generate-program', validate(generateProgramSchema), async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const params = req.body as z.infer<typeof generateProgramSchema>;

    const programParams: GenerateProgramParams = {
      duration: params.duration,
      daysPerWeek: params.daysPerWeek,
      focus: params.focus,
      equipment: params.equipment,
      injuries: params.injuries,
      userPreferences: params.userPreferences,
    };

    const trainer = getOrCreateTrainer(userId);
    await trainer.initialize();

    const program = await trainer.generateProgram(programParams);

    res.status(201).json({
      success: true,
      program,
      message: `Generated ${params.duration}-week ${params.focus} program with ${params.daysPerWeek} training days.`,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/adjust-program', validate(adjustProgramSchema), async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { week, feedback } = req.body as z.infer<typeof adjustProgramSchema> & { feedback: { averageEnergy?: number } };

    const trainer = getOrCreateTrainer(userId);
    await trainer.initialize();

    const adjustedProgram = await trainer.adjustWeeklyProgram(week, {
      ...feedback,
      averageEnergy: feedback.averageEnergy ?? 7,
    });

    res.json({
      success: true,
      adjustedProgram,
      message: `Program adjusted for week ${week} based on your feedback.`,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/chat', validate(chatSchema), async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { message, history } = req.body as z.infer<typeof chatSchema>;

    const convertedHistory: Message[] = history?.map(h => ({
      role: h.role,
      content: h.content,
      timestamp: h.timestamp ? new Date(h.timestamp) : undefined,
    })) || [];

    const trainer = getOrCreateTrainer(userId, convertedHistory);
    await trainer.initialize();

    const response = await trainer.chat(message);

    trainer.addToHistory({ role: 'user', content: message });
    trainer.addToHistory({ role: 'assistant', content: response.message });

    res.json({
      success: true,
      response,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/progression/:exerciseId', async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const exerciseId = req.params.exerciseId as string;

    const trainer = getOrCreateTrainer(userId);
    await trainer.initialize();

    const recommendation = await trainer.getProgressionRecommendation(exerciseId);

    res.json({
      success: true,
      recommendation,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/analyze', validate(analyzeSchema), async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { exerciseId, workoutId, timeframe } = req.body as z.infer<typeof analyzeSchema>;

    const trainer = getOrCreateTrainer(userId);
    await trainer.initialize();

    let analysis: AIResponse;

    if (exerciseId) {
      const recommendation = await trainer.getProgressionRecommendation(exerciseId);
      analysis = {
        message: `**Exercise Analysis: ${recommendation.exerciseName}**\n\n` +
                 `Current Performance:\n` +
                 `• Weight: ${recommendation.currentWeight}\n` +
                 `• Reps: ${recommendation.currentReps}\n` +
                 `• Est. 1RM: ${Math.round(recommendation.currentWeight * (1 + recommendation.currentReps / 30))}\n\n` +
                 `**Recommendation:**\n` +
                 `• Suggested Weight: ${recommendation.recommendedWeight}\n` +
                 `• Suggested Reps: ${recommendation.recommendedReps}\n` +
                 `• Reason: ${recommendation.reason}\n\n` +
                 (recommendation.deloadRecommended ? '⚠️ A deload may be beneficial.' : ''),
        type: 'answer',
        metadata: {
          exerciseId,
          recommendation,
        },
      };
    } else {
      analysis = await trainer.analyzeWorkoutPerformance();
    }

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/clear-history', async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const trainer = trainers.get(userId);
    if (trainer) {
      trainer.clearHistory();
    }

    res.json({
      success: true,
      message: 'Conversation history cleared.',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/context', async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const trainer = trainers.get(userId);

    if (!trainer) {
      res.json({
        hasProfile: false,
        systemPrompt: null,
      });
      return;
    }

    try {
      const systemPrompt = trainer.getSystemPrompt();
      res.json({
        hasProfile: true,
        systemPrompt,
      });
    } catch {
      res.json({
        hasProfile: false,
        systemPrompt: null,
      });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/save-program', async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { program } = req.body as { program: Program };

    const { prisma } = await import('../../../prisma/lib.js');

    await prisma.program.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    const createdProgram = await prisma.program.create({
      data: {
        userId,
        name: program.name,
        description: program.description,
        goal: program.goal,
        difficulty: program.difficulty,
        durationWeeks: program.durationWeeks,
        isActive: true,
        isGenerated: true,
      },
    });

    for (const day of program.programDays) {
      const createdDay = await prisma.programDay.create({
        data: {
          programId: createdProgram.id,
          dayNumber: day.dayNumber,
          name: day.name,
          description: day.description,
          focus: day.focus,
          isRestDay: day.isRestDay,
        },
      });

      for (const exercise of day.exercises) {
        const exerciseRecord = await prisma.exercise.findFirst({
          where: { name: exercise.exerciseName },
        });

        if (exerciseRecord) {
          await prisma.programDayExercise.create({
            data: {
              programDayId: createdDay.id,
              exerciseId: exerciseRecord.id,
              order: day.exercises.indexOf(exercise) + 1,
              targetSets: exercise.targetSets,
              targetReps: exercise.targetReps,
              targetRpe: exercise.targetRpe,
              restSeconds: exercise.restSeconds,
              notes: exercise.notes,
            },
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      programId: createdProgram.id,
      message: 'Program saved and set as active.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
