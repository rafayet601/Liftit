import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../prisma/lib.js';
import { userService, updateProfileSchema, userPreferencesSchema } from '../services/user.service.js';
import { authenticate, JwtPayload } from '../middleware/auth.js';
import { validate } from '../middleware/error.js';

const router = Router();

router.use(authenticate);

router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await userService.getProfile(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.put('/profile', validate(updateProfileSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await userService.updateProfile(userId, req.body);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.get('/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const preferences = await userService.getPreferences(userId);
    res.json(preferences);
  } catch (error) {
    next(error);
  }
});

router.put('/preferences', validate(userPreferencesSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const preferences = await userService.updatePreferences(userId, req.body);
    res.json(preferences);
  } catch (error) {
    next(error);
  }
});

router.delete('/account', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await userService.deleteAccount(userId);
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalWorkouts, workoutsThisWeek, workoutsThisMonth, recentWorkouts] = await Promise.all([
      prisma.workoutLog.count({ where: { userId } }),
      prisma.workoutLog.count({ where: { userId, startedAt: { gte: startOfWeek } } }),
      prisma.workoutLog.count({ where: { userId, startedAt: { gte: startOfMonth } } }),
      prisma.workoutLog.findMany({
        where: { userId, isCompleted: true },
        orderBy: { completedAt: 'desc' },
        take: 10,
        select: { completedAt: true, duration: true },
      }),
    ]);

    let trainingStreak = 0;
    const sortedWorkouts = recentWorkouts.filter(w => w.completedAt).sort((a, b) => 
      new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
    );
    
    if (sortedWorkouts.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let checkDate = new Date(today);
      
      for (let i = 0; i < 60; i++) {
        const dayStr = checkDate.toISOString().split('T')[0];
        const hasWorkout = sortedWorkouts.some(w => 
          w.completedAt && w.completedAt.toISOString().split('T')[0] === dayStr
        );
        
        if (hasWorkout) {
          trainingStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (i > 0) {
          break;
        } else {
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
    }

    const setsThisWeek = await prisma.workoutSet.count({
      where: {
        workoutLog: { userId, startedAt: { gte: startOfWeek } },
      },
    });

    const activeProgram = await prisma.program.findFirst({
      where: { userId, isActive: true },
      include: { mesocycle: true },
    });

    res.json({
      totalWorkouts,
      workoutsThisWeek,
      workoutsThisMonth,
      trainingStreak,
      weeklyVolume: setsThisWeek * 10,
      weeklyTargetVolume: 60000,
      activeProgram: activeProgram ? {
        id: activeProgram.id,
        name: activeProgram.name,
        mesocycle: activeProgram.mesocycle,
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
