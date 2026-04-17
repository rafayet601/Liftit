import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma/lib.js';
import { authenticate, JwtPayload } from '../middleware/auth.js';
import { validate } from '../middleware/error.js';

const router = Router();

router.use(authenticate);

const createWorkoutLogSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  programDayId: z.string().optional(),
  notes: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  duration: z.number().int().positive().optional(),
  isCompleted: z.boolean().default(false),
  mood: z.string().optional(),
  energy: z.number().int().min(1).max(10).optional(),
  sets: z.array(z.object({
    exerciseId: z.string(),
    setNumber: z.number().int().positive(),
    reps: z.number().int().positive().optional(),
    weight: z.number().nonnegative().optional(),
    rpe: z.number().min(1).max(10).optional(),
    distance: z.number().positive().optional(),
    duration: z.number().positive().optional(),
    isWarmup: z.boolean().default(false),
    isDropSet: z.boolean().default(false),
    isFailure: z.boolean().default(false),
    notes: z.string().optional(),
  })).optional(),
});

const updateWorkoutLogSchema = createWorkoutLogSchema.partial();

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

    const where: Record<string, unknown> = { userId };

    if (req.query.startDate || req.query.endDate) {
      where.startedAt = {};
      if (req.query.startDate) (where.startedAt as Record<string, unknown>).gte = new Date(req.query.startDate as string);
      if (req.query.endDate) (where.startedAt as Record<string, unknown>).lte = new Date(req.query.endDate as string);
    }

    const [workoutLogs, total] = await Promise.all([
      prisma.workoutLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          sets: {
            include: {
              exercise: true,
            },
          },
          programDay: true,
        },
      }),
      prisma.workoutLog.count({ where }),
    ]);

    res.json({
      data: workoutLogs,
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

router.post('/', validate(createWorkoutLogSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { sets, ...workoutData } = req.body;

    const workoutLog = await prisma.workoutLog.create({
      data: {
        userId,
        name: workoutData.name,
        programDayId: workoutData.programDayId,
        notes: workoutData.notes,
        startedAt: workoutData.startedAt ? new Date(workoutData.startedAt) : new Date(),
        completedAt: workoutData.completedAt ? new Date(workoutData.completedAt) : undefined,
        duration: workoutData.duration,
        isCompleted: workoutData.isCompleted,
        mood: workoutData.mood,
        energy: workoutData.energy,
        sets: sets ? {
          create: sets.map((set: {
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
          }) => ({
            exerciseId: set.exerciseId,
            setNumber: set.setNumber,
            reps: set.reps,
            weight: set.weight,
            rpe: set.rpe,
            distance: set.distance,
            duration: set.duration,
            isWarmup: set.isWarmup || false,
            isDropSet: set.isDropSet || false,
            isFailure: set.isFailure || false,
            notes: set.notes,
          })),
        } : undefined,
      },
      include: {
        sets: {
          include: {
            exercise: true,
          },
        },
        programDay: true,
      },
    });

    res.status(201).json(workoutLog);
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
    const workoutLog = await prisma.workoutLog.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        sets: {
          include: {
            exercise: true,
          },
          orderBy: { setNumber: 'asc' },
        },
        programDay: {
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!workoutLog) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }

    res.json(workoutLog);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', validate(updateWorkoutLogSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = req.params.id as string;
    const existing = await prisma.workoutLog.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }

    const { sets, ...workoutData } = req.body;

    await prisma.workoutLog.update({
      where: { id },
      data: {
        name: workoutData.name,
        programDayId: workoutData.programDayId,
        notes: workoutData.notes,
        startedAt: workoutData.startedAt ? new Date(workoutData.startedAt) : undefined,
        completedAt: workoutData.completedAt ? new Date(workoutData.completedAt) : undefined,
        duration: workoutData.duration,
        isCompleted: workoutData.isCompleted,
        mood: workoutData.mood,
        energy: workoutData.energy,
      },
    });

    if (sets) {
      await prisma.workoutSet.deleteMany({ where: { workoutLogId: id } });
      await prisma.workoutSet.createMany({
        data: sets.map((set: {
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
        }) => ({
          workoutLogId: id,
          exerciseId: set.exerciseId,
          setNumber: set.setNumber,
          reps: set.reps,
          weight: set.weight,
          rpe: set.rpe,
          distance: set.distance,
          duration: set.duration,
          isWarmup: set.isWarmup || false,
          isDropSet: set.isDropSet || false,
          isFailure: set.isFailure || false,
          notes: set.notes,
        })),
      });
    }

    const updated = await prisma.workoutLog.findUnique({
      where: { id },
      include: {
        sets: {
          include: { exercise: true },
          orderBy: { setNumber: 'asc' },
        },
      },
    });

    res.json(updated);
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
    const existing = await prisma.workoutLog.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }

    await prisma.workoutLog.delete({ where: { id } });
    res.json({ message: 'Workout deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
