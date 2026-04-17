import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { mcpService } from '../services/mcp.service.js';

const userIdSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

function validateUserId(args: unknown) {
  return userIdSchema.safeParse(args);
}

export function registerUserTools(server: McpServer): void {
  server.registerTool(
    'get_user_profile',
    {
      title: 'Get User Profile',
      description: 'Get user profile with fitness level and goals. Returns comprehensive user information including name, fitness level, goals, experience, preferred units, and training history statistics.',
      inputSchema: z.object({
        userId: z.string().describe('The unique identifier of the user'),
      }),
    },
    async (args: { userId: string }): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      const parsed = validateUserId(args);
      if (!parsed.success) {
        throw new Error(`Invalid input: ${parsed.error.message}`);
      }

      const profile = await mcpService.getUserProfile(parsed.data.userId);
      return {
        content: [{ type: 'text', text: JSON.stringify(profile, null, 2) }],
      };
    }
  );
}
