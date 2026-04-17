import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { mcpService } from '../services/mcp.service.js';

const workoutInputSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  name: z.string().optional(),
  programDayId: z.string().optional(),
  notes: z.string().optional(),
  mood: z.string().optional(),
  energy: z.number().int().min(1).max(10).optional(),
  startedAt: z.string().datetime().optional(),
});

const logSetsInputSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  sets: z.array(z.object({
    workoutLogId: z.string().min(1, 'Workout log ID is required'),
    exerciseId: z.string().min(1, 'Exercise ID is required'),
    setNumber: z.number().int().min(1),
    reps: z.number().int().min(0).optional(),
    weight: z.number().min(0).optional(),
    rpe: z.number().min(1).max(10).optional(),
    distance: z.number().min(0).optional(),
    duration: z.number().int().min(0).optional(),
    isWarmup: z.boolean().optional().default(false),
    isDropSet: z.boolean().optional().default(false),
    isFailure: z.boolean().optional().default(false),
    notes: z.string().optional(),
  })).min(1, 'At least one set is required'),
});

export function registerWorkoutTools(server: McpServer): void {
  server.registerTool(
    'get_workout_history',
    {
      title: 'Get Workout History',
      description: 'Get workout logs for analysis. Returns workout history for a specified time period including all sets performed.',
      inputSchema: z.object({
        userId: z.string().describe('The unique identifier of the user'),
        days: z.number().int().min(1).max(365).optional().describe('Number of days to look back (default: 30)'),
      }),
    },
    async (args: { userId: string; days?: number }): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      const history = await mcpService.getWorkoutHistory(args.userId, args.days || 30);
      return { content: [{ type: 'text', text: JSON.stringify(history, null, 2) }] };
    }
  );

  server.registerTool(
    'get_exercise_history',
    {
      title: 'Get Exercise History',
      description: 'Get specific exercise history. Returns all sets performed for a specific exercise over a given time period.',
      inputSchema: z.object({
        userId: z.string().describe('The unique identifier of the user'),
        exerciseId: z.string().describe('The unique identifier of the exercise'),
        weeks: z.number().int().min(1).max(52).optional().describe('Number of weeks to look back (default: 4)'),
      }),
    },
    async (args: { userId: string; exerciseId: string; weeks?: number }): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      const history = await mcpService.getExerciseHistory(args.userId, args.exerciseId, args.weeks || 4);
      return { content: [{ type: 'text', text: JSON.stringify(history, null, 2) }] };
    }
  );

  server.registerTool(
    'log_workout',
    {
      title: 'Log Workout',
      description: 'Log a completed workout. Creates a new workout log entry.',
      inputSchema: workoutInputSchema,
    },
    async (args: { userId: string; name?: string; programDayId?: string; notes?: string; mood?: string; energy?: number; startedAt?: string }): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      const parsed = workoutInputSchema.safeParse(args);
      if (!parsed.success) {
        throw new Error(`Invalid input: ${parsed.error.message}`);
      }
      const workout = await mcpService.logWorkout(parsed.data);
      return { content: [{ type: 'text', text: JSON.stringify(workout, null, 2) }] };
    }
  );

  server.registerTool(
    'log_sets',
    {
      title: 'Log Sets',
      description: 'Log individual sets. Logs one or more sets for an existing workout.',
      inputSchema: logSetsInputSchema,
    },
    async (args: { userId: string; sets: Array<{
      workoutLogId: string;
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
    }> }): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      const parsed = logSetsInputSchema.safeParse(args);
      if (!parsed.success) {
        throw new Error(`Invalid input: ${parsed.error.message}`);
      }
      const sets = await mcpService.logSets(parsed.data);
      return { content: [{ type: 'text', text: JSON.stringify(sets, null, 2) }] };
    }
  );
}
