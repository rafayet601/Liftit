import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma/lib.js';
import { authenticate, JwtPayload } from '../middleware/auth.js';
import { validate } from '../middleware/error.js';

const router = Router();

router.use(authenticate);

const createProgramSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  goal: z.string().default('strength'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
  durationWeeks: z.number().int().positive().default(4),
  isActive: z.boolean().default(false),
  isGenerated: z.boolean().default(false),
  mesocycleId: z.string().optional(),
  programDays: z.array(z.object({
    dayNumber: z.number().int().min(1).max(7),
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    focus: z.string().optional(),
    isRestDay: z.boolean().default(false),
    exercises: z.array(z.object({
      exerciseId: z.string(),
      order: z.number().int().positive(),
      targetSets: z.number().int().positive().optional(),
      targetReps: z.string().optional(),
      targetRpe: z.number().min(1).max(10).optional(),
      restSeconds: z.number().int().positive().optional(),
      notes: z.string().optional(),
    })).optional(),
  })).optional(),
});

const updateProgramSchema = createProgramSchema.partial();

interface ProgramDayExerciseInput {
  exerciseId: string;
  order: number;
  targetSets?: number;
  targetReps?: string;
  targetRpe?: number;
  restSeconds?: number;
  notes?: string;
}

interface ProgramDayInput {
  dayNumber: number;
  name: string;
  description?: string;
  focus?: string;
  isRestDay: boolean;
  exercises?: ProgramDayExerciseInput[];
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');
    const skip = (page - 1) * limit;

    const [programs, total] = await Promise.all([
      prisma.program.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          programDays: {
            orderBy: { dayNumber: 'asc' },
            include: {
              exercises: {
                include: { exercise: true },
                orderBy: { order: 'asc' },
              },
            },
          },
          mesocycle: true,
        },
      }),
      prisma.program.count({ where: { userId } }),
    ]);

    res.json({
      data: programs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', validate(createProgramSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { programDays, isActive, mesocycleId, ...programData } = req.body;

    if (isActive) {
      await prisma.program.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
    }

    const program = await prisma.program.create({
      data: {
        userId,
        name: programData.name,
        description: programData.description,
        goal: programData.goal,
        difficulty: programData.difficulty,
        durationWeeks: programData.durationWeeks,
        isActive: programData.isActive || false,
        isGenerated: programData.isGenerated || false,
        mesocycleId,
        programDays: programDays ? {
          create: programDays.map((day: ProgramDayInput) => ({
            dayNumber: day.dayNumber,
            name: day.name,
            description: day.description,
            focus: day.focus,
            isRestDay: day.isRestDay,
            exercises: day.exercises ? {
              create: day.exercises.map((e: ProgramDayExerciseInput) => ({
                exerciseId: e.exerciseId,
                order: e.order,
                targetSets: e.targetSets,
                targetReps: e.targetReps,
                targetRpe: e.targetRpe,
                restSeconds: e.restSeconds,
                notes: e.notes,
              })),
            } : undefined,
          })),
        } : undefined,
      },
      include: {
        programDays: {
          orderBy: { dayNumber: 'asc' },
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { order: 'asc' },
            },
          },
        },
        mesocycle: true,
      },
    });

    res.status(201).json(program);
  } catch (error) {
    next(error);
  }
});

router.get('/current', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const program = await prisma.program.findFirst({
      where: {
        userId,
        isActive: true,
      },
      include: {
        programDays: {
          orderBy: { dayNumber: 'asc' },
          include: {
            exercises: {
              orderBy: { order: 'asc' },
              include: { exercise: true },
            },
          },
        },
        mesocycle: true,
      },
    });

    if (!program) {
      res.status(404).json({ error: 'No active program found' });
      return;
    }

    res.json(program);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = req.params.id as string;
    const program = await prisma.program.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        programDays: {
          orderBy: { dayNumber: 'asc' },
          include: {
            exercises: {
              orderBy: { order: 'asc' },
              include: { exercise: true },
            },
          },
        },
        mesocycle: true,
      },
    });

    if (!program) {
      res.status(404).json({ error: 'Program not found' });
      return;
    }

    res.json(program);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', validate(updateProgramSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = req.params.id as string;
    const existing = await prisma.program.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Program not found' });
      return;
    }

    const { programDays, isActive, mesocycleId, ...programData } = req.body;

    if (isActive) {
      await prisma.program.updateMany({
        where: { userId, isActive: true, id: { not: id } },
        data: { isActive: false },
      });
    }

    const program = await prisma.program.update({
      where: { id },
      data: {
        name: programData.name,
        description: programData.description,
        goal: programData.goal,
        difficulty: programData.difficulty,
        durationWeeks: programData.durationWeeks,
        isActive: programData.isActive,
        isGenerated: programData.isGenerated,
        mesocycleId,
      },
      include: {
        programDays: {
          orderBy: { dayNumber: 'asc' },
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { order: 'asc' },
            },
          },
        },
        mesocycle: true,
      },
    });

    res.json(program);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = req.params.id as string;
    const existing = await prisma.program.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Program not found' });
      return;
    }

    await prisma.program.delete({ where: { id } });
    res.json({ message: 'Program deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
