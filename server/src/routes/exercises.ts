import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../prisma/lib.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.use(optionalAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '50');
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (req.query.search) {
      const search = req.query.search as string;
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (req.query.muscleGroup) {
      where.muscleGroup = req.query.muscleGroup;
    }

    if (req.query.equipment) {
      where.equipment = req.query.equipment;
    }

    if (req.query.difficulty) {
      where.difficulty = req.query.difficulty;
    }

    if (req.query.isCompound !== undefined) {
      where.isCompound = req.query.isCompound === 'true';
    }

    if (req.query.isIsolation !== undefined) {
      where.isIsolation = req.query.isIsolation === 'true';
    }

    if (req.query.isCardio !== undefined) {
      where.isCardio = req.query.isCardio === 'true';
    }

    const [exercises, total] = await Promise.all([
      prisma.exercise.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.exercise.count({ where }),
    ]);

    res.json({
      data: exercises,
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

router.get('/muscle-groups', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const muscleGroups = await prisma.exercise.findMany({
      select: { muscleGroup: true },
      distinct: ['muscleGroup'],
      orderBy: { muscleGroup: 'asc' },
    });
    res.json(muscleGroups.map((m: { muscleGroup: string }) => m.muscleGroup));
  } catch (error) {
    next(error);
  }
});

router.get('/equipment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const equipment = await prisma.exercise.findMany({
      select: { equipment: true },
      distinct: ['equipment'],
      where: { equipment: { not: null } },
      orderBy: { equipment: 'asc' },
    });
    res.json(equipment.map((e: { equipment: string | null }) => e.equipment).filter((e): e is string => e !== null));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const exercise = await prisma.exercise.findUnique({
      where: { id },
    });

    if (!exercise) {
      res.status(404).json({ error: 'Exercise not found' });
      return;
    }

    res.json(exercise);
  } catch (error) {
    next(error);
  }
});

router.get('/muscle/:muscleGroup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const muscleGroup = req.params.muscleGroup as string;
    const exercises = await prisma.exercise.findMany({
      where: { muscleGroup },
      orderBy: { name: 'asc' },
    });
    res.json(exercises);
  } catch (error) {
    next(error);
  }
});

export default router;
