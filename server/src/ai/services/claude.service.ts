import Anthropic from '@anthropic-ai/sdk';
import config from '../../config/env.js';
import { Message, AIResponse, MCPUserData, MCPExercise } from '../types/index.js';
import { groqService } from './groq.service.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface MCPTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type AIProvider = 'groq' | 'claude';

export class ClaudeService {
  private model = 'claude-sonnet-4-20250514';
  private maxTokens = 4096;
  private defaultProvider: AIProvider = process.env.GROQ_API_KEY ? 'groq' : 'claude';

  async chat(
    systemPrompt: string,
    messages: Message[],
    mcpTools: MCPTool[] = [],
    provider?: AIProvider
  ): Promise<{ response: string; toolResults?: ToolResult[] }> {
    const useProvider = provider || this.defaultProvider;

    // Try Groq first if selected
    if (useProvider === 'groq' && process.env.GROQ_API_KEY) {
      try {
        // Convert MCP tools to Groq format if needed
        const groqTools = mcpTools.map(tool => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
          },
        }));

        const result = await groqService.chat(systemPrompt, messages, groqTools);
        return {
          response: result.response,
          toolResults: result.toolResults,
        };
      } catch (error) {
        console.warn('Groq API failed, falling back to Claude:', error);
        // Fall through to Claude
      }
    }

    // Claude implementation
    const formattedMessages = messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    const response = await anthropic.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: formattedMessages,
    });

    const textContent = response.content.filter(
      (block) => block.type === 'text'
    );
    const toolUseContent = response.content.filter(
      (block) => block.type === 'tool_use'
    );

    const toolResults: ToolResult[] = [];
    if (toolUseContent.length > 0) {
      for (const toolBlock of toolUseContent) {
        if (toolBlock.type === 'tool_use') {
          toolResults.push({
            tool_use_id: toolBlock.id,
            content: JSON.stringify(toolBlock.input),
          });
        }
      }
    }

    const responseText = textContent
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n');

    return { response: responseText, toolResults };
  }

  async generateStructuredResponse<T>(
    systemPrompt: string,
    userMessage: string,
    _mcpTools: MCPTool[] = [],
    provider?: AIProvider
  ): Promise<T> {
    const useProvider = provider || this.defaultProvider;

    // Try Groq first if selected
    if (useProvider === 'groq' && process.env.GROQ_API_KEY) {
      try {
        return await groqService.generateStructuredResponse<T>(systemPrompt, userMessage);
      } catch (error) {
        console.warn('Groq API failed, falling back to Claude:', error);
        // Fall through to Claude
      }
    }

    // Claude implementation
    const response = await anthropic.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const textContent = response.content.filter(
      (block) => block.type === 'text'
    );

    const responseText = textContent
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n');

    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) ||
                      responseText.match(/```\n([\s\S]*?)\n```/) ||
                      responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr) as T;
    }

    return { response: responseText } as T;
  }

  async analyzeWorkoutPerformance(
    userData: MCPUserData,
    systemPrompt: string,
    provider?: AIProvider
  ): Promise<AIResponse> {
    const useProvider = provider || this.defaultProvider;

    // Try Groq first if selected
    if (useProvider === 'groq' && process.env.GROQ_API_KEY) {
      try {
        return await groqService.analyzeWorkoutPerformance(userData, systemPrompt);
      } catch (error) {
        console.warn('Groq API failed, falling back to Claude:', error);
        // Fall through to Claude
      }
    }

    const message = `
Analyze this user's workout performance:

User Profile:
- Fitness Level: ${userData.profile.fitnessLevel}
- Primary Goal: ${userData.profile.primaryGoal}
- Training Age: ${userData.profile.experienceYears || 'Not specified'} years
- Preferred Units: ${userData.profile.preferredUnits}

Recent Workouts:
${userData.recentWorkouts.slice(0, 5).map(workout => `
Workout: ${workout.name || 'Unnamed'}
Date: ${workout.startedAt}
Completed: ${workout.isCompleted}
Sets:
${workout.sets.map(set => `  - ${set.exerciseName}: ${set.weight} ${userData.profile.preferredUnits} x ${set.reps} reps ${set.rpe ? `@ RPE ${set.rpe}` : ''}`).join('\n')}
`).join('\n')}

Provide an analysis of:
1. Overall performance trends
2. Which exercises are progressing well
3. Which exercises may need attention
4. Recommended adjustments

Format your response as a motivational but data-driven assessment.
`;

    const { response } = await this.chat(systemPrompt, [
      { role: 'user', content: message },
    ]);

    return {
      message: response,
      type: 'answer',
      metadata: {
        analyzedWorkouts: userData.recentWorkouts.length,
      },
    };
  }
}

export const claudeService = new ClaudeService();

export const mcpTools: MCPTool[] = [
  {
    name: 'get_user_profile',
    description: 'Get the user profile including fitness level, goals, experience, and preferences',
    input_schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
      },
      required: ['userId'],
    },
  },
  {
    name: 'get_user_workout_history',
    description: 'Get the user recent workout history with set details',
    input_schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        limit: { type: 'number', description: 'Number of workouts to retrieve', default: 10 },
      },
      required: ['userId'],
    },
  },
  {
    name: 'get_exercise_history',
    description: 'Get the detailed history for a specific exercise',
    input_schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        exerciseId: { type: 'string', description: 'The exercise ID' },
        limit: { type: 'number', description: 'Number of sets to retrieve', default: 20 },
      },
      required: ['userId', 'exerciseId'],
    },
  },
  {
    name: 'get_available_exercises',
    description: 'Get list of available exercises with filtering options',
    input_schema: {
      type: 'object',
      properties: {
        muscleGroup: { type: 'string', description: 'Filter by muscle group' },
        equipment: { type: 'string', description: 'Filter by equipment' },
        difficulty: { type: 'string', description: 'Filter by difficulty level' },
      },
    },
  },
  {
    name: 'get_progression_rules',
    description: 'Get user-specific progression rules for an exercise',
    input_schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        exerciseId: { type: 'string', description: 'The exercise ID' },
      },
      required: ['userId', 'exerciseId'],
    },
  },
  {
    name: 'log_workout',
    description: 'Log a completed workout set',
    input_schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        workoutLogId: { type: 'string', description: 'The workout log ID' },
        exerciseId: { type: 'string', description: 'The exercise ID' },
        setNumber: { type: 'number', description: 'Set number' },
        reps: { type: 'number', description: 'Number of reps' },
        weight: { type: 'number', description: 'Weight used' },
        rpe: { type: 'number', description: 'Rate of perceived exertion (1-10)' },
      },
      required: ['userId', 'exerciseId', 'reps', 'weight'],
    },
  },
];
