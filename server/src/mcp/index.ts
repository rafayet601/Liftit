import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ErrorCode, McpError, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import {
  registerUserTools,
} from './tools/user.tools.js';
import {
  registerWorkoutTools,
} from './tools/workout.tools.js';
import {
  registerProgramTools,
} from './tools/program.tools.js';
import {
  registerProgressionTools,
} from './tools/progression.tools.js';

export { ErrorCode, McpError };

interface McpJwtPayload {
  userId: string;
  email: string;
}

export function extractUserFromToken(authHeader: string | undefined): McpJwtPayload | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, config.jwtSecret) as McpJwtPayload;
  } catch {
    return null;
  }
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'liftit-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  registerUserTools(server);
  registerWorkoutTools(server);
  registerProgramTools(server);
  registerProgressionTools(server);

  return server;
}

export async function createMcpTransport(): Promise<StreamableHTTPServerTransport> {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  return transport;
}

export { createMcpServer as mcpServer };
