import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import config from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { setupPassport } from './config/passport.js';
import { createMcpServer, extractUserFromToken } from './mcp/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import workoutRoutes from './routes/workouts.js';
import exerciseRoutes from './routes/exercises.js';
import programRoutes from './routes/programs.js';
import aiRoutes from './ai/routes/ai.routes.js';

const app: Express = express();

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

setupPassport();
app.use(passport.initialize());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/ai', aiRoutes);

app.post('/api/sync', async (req: Request, res: Response) => {
  try {
    const { workoutLogs, programs } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(authHeader.split(' ')[1], config.jwtSecret) as { userId: string };
    } catch {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const { prisma } = await import('../prisma/lib.js');
    const userId = decoded.userId;

    const results: { imported: number; skipped: number; errors: string[] } = {
      imported: 0,
      skipped: 0,
      errors: [],
    };

    if (workoutLogs && Array.isArray(workoutLogs)) {
      for (const workout of workoutLogs) {
        try {
          const existing = await prisma.workoutLog.findFirst({
            where: {
              userId,
              name: workout.name,
              startedAt: new Date(workout.startedAt || workout.date),
            },
          });

          if (existing) {
            results.skipped++;
            continue;
          }

          const sets = workout.sets || [];
          delete workout.sets;

          await prisma.workoutLog.create({
            data: {
              userId,
              name: workout.name,
              notes: workout.notes,
              startedAt: new Date(workout.startedAt || workout.date),
              completedAt: workout.completedAt ? new Date(workout.completedAt) : undefined,
              duration: workout.duration,
              isCompleted: workout.isCompleted || false,
              mood: workout.mood,
              energy: workout.energy,
              sets: sets.length > 0 ? {
                create: sets.map((set: { exerciseId: string; reps?: number; weight?: number; rpe?: number; distance?: number; duration?: number; notes?: string }, idx: number) => ({
                  exerciseId: set.exerciseId,
                  setNumber: idx + 1,
                  reps: set.reps,
                  weight: set.weight,
                  rpe: set.rpe,
                  distance: set.distance,
                  duration: set.duration,
                  notes: set.notes,
                })),
              } : undefined,
            },
          });
          results.imported++;
        } catch (err) {
          results.errors.push(`Workout ${workout.name}: ${(err as Error).message}`);
        }
      }
    }

    if (programs && Array.isArray(programs)) {
      for (const program of programs) {
        try {
          const existing = await prisma.program.findFirst({
            where: {
              userId,
              name: program.name,
            },
          });

          if (existing) {
            results.skipped++;
            continue;
          }

          const programDays = program.programDays || [];
          delete program.programDays;

          await prisma.program.create({
            data: {
              userId,
              name: program.name,
              description: program.description,
              goal: program.goal || 'strength',
              difficulty: program.difficulty || 'intermediate',
              durationWeeks: program.durationWeeks || 4,
              isActive: program.isActive || false,
              isGenerated: program.isGenerated || false,
              programDays: programDays.length > 0 ? {
                create: programDays.map((day: { dayNumber: number; name: string; description?: string; focus?: string; isRestDay?: boolean; exercises?: { exerciseId: string; order: number; targetSets?: number; targetReps?: string; notes?: string }[] }) => ({
                  dayNumber: day.dayNumber,
                  name: day.name,
                  description: day.description,
                  focus: day.focus,
                  isRestDay: day.isRestDay || false,
                  exercises: day.exercises ? {
                    create: day.exercises.map((e: { exerciseId: string; order: number; targetSets?: number; targetReps?: string; notes?: string }) => ({
                      exerciseId: e.exerciseId,
                      order: e.order,
                      targetSets: e.targetSets,
                      targetReps: e.targetReps,
                      notes: e.notes,
                    })),
                  } : undefined,
                })),
              } : undefined,
            },
          });
          results.imported++;
        } catch (err) {
          results.errors.push(`Program ${program.name}: ${(err as Error).message}`);
        }
      }
    }

    res.json({
      message: 'Sync completed',
      results,
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync data' });
  }
});

const mcpServer = createMcpServer();

app.post('/api/mcp', async (req: Request, res: Response) => {
  const user = extractUserFromToken(req.headers.authorization);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized - valid JWT token required' });
    return;
  }

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP request error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

app.get('/api/mcp/sse', async (req: Request, res: Response) => {
  const user = extractUserFromToken(req.headers.authorization);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized - valid JWT token required' });
    return;
  }

  try {
    const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js');
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const transport = new SSEServerTransport('/api/mcp/sse', res);

    const heartbeatInterval = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeatInterval);
    });

    await mcpServer.connect(transport);
  } catch (error) {
    console.error('MCP SSE error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

app.post('/api/mcp/message', async (req: Request, res: Response) => {
  const user = extractUserFromToken(req.headers.authorization);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized - valid JWT token required' });
    return;
  }

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP message error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
