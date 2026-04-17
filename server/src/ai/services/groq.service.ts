import Groq from 'groq-sdk';
import { Message, AIResponse, MCPUserData, MCPExercise } from '../types/index.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
}

interface GroqTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export class GroqService {
  private model: string;

  constructor() {
    this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  }

  async chat(
    systemPrompt: string,
    messages: Message[],
    tools: GroqTool[] = []
  ): Promise<{ response: string; toolResults?: ToolResult[] }> {
    const formattedMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }))
    ];

    const completion = await groq.chat.completions.create({
      model: this.model,
      messages: formattedMessages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      temperature: 0.7,
      max_tokens: 4096,
    });

    const message = completion.choices[0].message;
    const toolResults: ToolResult[] = [];

    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        toolResults.push({
          tool_use_id: toolCall.id,
          content: JSON.stringify(toolCall.function.arguments),
        });
      }
    }

    return {
      response: message.content || '',
      toolResults: toolResults.length > 0 ? toolResults : undefined,
    };
  }

  async generateStructuredResponse<T>(
    systemPrompt: string,
    userMessage: string
  ): Promise<T> {
    const completion = await groq.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt + '\n\nRespond ONLY with valid JSON.' },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 4096,
    });

    const responseText = completion.choices[0].message.content || '{}';
    return JSON.parse(responseText) as T;
  }

  async analyzeWorkoutPerformance(
    userData: MCPUserData,
    systemPrompt: string
  ): Promise<AIResponse> {
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

  async generateExerciseRecommendations(
    userData: MCPUserData,
    muscleGroup: string,
    targetSets: number
  ): Promise<MCPExercise[]> {
    const systemPrompt = `You are a fitness expert. Recommend exercises for ${muscleGroup} targeting ${targetSets} sets.
Respond ONLY with a valid JSON array of exercise objects with fields: name, muscleGroup, equipment, difficulty, isCompound.`;

    const exercises = await this.generateStructuredResponse<MCPExercise[]>(
      systemPrompt,
      `Recommend ${targetSets} exercises for ${muscleGroup} training.`
    );

    return exercises;
  }
}

export const groqService = new GroqService();

export const groqTools: GroqTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_user_profile',
      description: 'Get the user profile including fitness level, goals, experience, and preferences',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The user ID' },
        },
        required: ['userId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_workout_history',
      description: 'Get the user recent workout history with set details',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The user ID' },
          limit: { type: 'number', description: 'Number of workouts to retrieve', default: 10 },
        },
        required: ['userId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_exercise_history',
      description: 'Get the detailed history for a specific exercise',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The user ID' },
          exerciseId: { type: 'string', description: 'The exercise ID' },
          limit: { type: 'number', description: 'Number of sets to retrieve', default: 20 },
        },
        required: ['userId', 'exerciseId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_available_exercises',
      description: 'Get list of available exercises with filtering options',
      parameters: {
        type: 'object',
        properties: {
          muscleGroup: { type: 'string', description: 'Filter by muscle group' },
          equipment: { type: 'string', description: 'Filter by equipment' },
          difficulty: { type: 'string', description: 'Filter by difficulty level' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_progression_rules',
      description: 'Get user-specific progression rules for an exercise',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The user ID' },
          exerciseId: { type: 'string', description: 'The exercise ID' },
        },
        required: ['userId', 'exerciseId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_workout',
      description: 'Log a completed workout set',
      parameters: {
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
  },
];
