import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { mcpService } from '../services/mcp.service.js';

export function registerProgramTools(server: McpServer): void {
  server.registerTool(
    'get_current_program',
    {
      title: 'Get Current Program',
      description: "Get user's current active program. Retrieves the currently active training program for the user.",
      inputSchema: z.object({
        userId: z.string().describe('The unique identifier of the user'),
      }),
    },
    async (args: { userId: string }): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      const program = await mcpService.getCurrentProgram(args.userId);
      return { content: [{ type: 'text', text: JSON.stringify(program, null, 2) }] };
    }
  );

  server.registerTool(
    'get_weekly_program',
    {
      title: 'Get Weekly Program',
      description: "Get program for a specific week. Retrieves the training days and exercises scheduled for a specific week of the user's active program.",
      inputSchema: z.object({
        userId: z.string().describe('The unique identifier of the user'),
        week: z.number().int().min(1).max(52).describe('The week number (1-indexed)'),
      }),
    },
    async (args: { userId: string; week: number }): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      const parsed = z.object({
        userId: z.string().min(1),
        week: z.number().int().min(1).max(52),
      }).safeParse(args);
      
      if (!parsed.success) {
        throw new Error(`Invalid input: ${parsed.error.message}`);
      }
      
      const program = await mcpService.getWeeklyProgram(parsed.data.userId, parsed.data.week);
      return { content: [{ type: 'text', text: JSON.stringify(program, null, 2) }] };
    }
  );

  server.registerTool(
    'get_exercise',
    {
      title: 'Get Exercise',
      description: 'Get exercise details. Retrieves detailed information about a specific exercise.',
      inputSchema: z.object({
        exerciseId: z.string().describe('The unique identifier of the exercise'),
      }),
    },
    async (args: { exerciseId: string }): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      const exercise = await mcpService.getExercise(args.exerciseId);
      return { content: [{ type: 'text', text: JSON.stringify(exercise, null, 2) }] };
    }
  );
}
