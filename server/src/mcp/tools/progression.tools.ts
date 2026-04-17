import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { mcpService } from '../services/mcp.service.js';

export function registerProgressionTools(server: McpServer): void {
  server.registerTool(
    'calculate_progression',
    {
      title: 'Calculate Progression',
      description: 'Calculate recommended progression for an exercise. Analyzes recent performance data and calculates recommended weight and reps.',
      inputSchema: z.object({
        userId: z.string().describe('The unique identifier of the user'),
        exerciseId: z.string().describe('The unique identifier of the exercise'),
      }),
    },
    async (args: { userId: string; exerciseId: string }): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      const parsed = z.object({
        userId: z.string().min(1, 'User ID is required'),
        exerciseId: z.string().min(1, 'Exercise ID is required'),
      }).safeParse(args);
      
      if (!parsed.success) {
        throw new Error(`Invalid input: ${parsed.error.message}`);
      }
      
      const progression = await mcpService.calculateProgression(parsed.data.userId, parsed.data.exerciseId);
      return { content: [{ type: 'text', text: JSON.stringify(progression, null, 2) }] };
    }
  );

  server.registerTool(
    'analyze_performance',
    {
      title: 'Analyze Performance',
      description: 'Analyze recent performance and suggest adjustments. Performs a comprehensive analysis of recent workout performance.',
      inputSchema: z.object({
        userId: z.string().describe('The unique identifier of the user'),
        exerciseId: z.string().describe('The unique identifier of the exercise'),
      }),
    },
    async (args: { userId: string; exerciseId: string }): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      const parsed = z.object({
        userId: z.string().min(1, 'User ID is required'),
        exerciseId: z.string().min(1, 'Exercise ID is required'),
      }).safeParse(args);
      
      if (!parsed.success) {
        throw new Error(`Invalid input: ${parsed.error.message}`);
      }
      
      const analysis = await mcpService.analyzePerformance(parsed.data.userId, parsed.data.exerciseId);
      return { content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }] };
    }
  );
}
