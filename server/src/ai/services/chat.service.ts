import { claudeService, mcpTools } from './claude.service.js';
import { generateSystemPrompt, formCueLibrary } from '../prompts/system-prompt.js';
import { mcpService } from '../../mcp/services/mcp.service.js';
import { prisma } from '../../../prisma/lib.js';
import {
  AIResponse,
  Message,
  UserProfile,
  TrainingFocus,
} from '../types/index.js';

export interface ChatContext {
  userId: string;
  userProfile: UserProfile;
  conversationHistory: Message[];
}

interface ConversationTurn {
  user: string;
  assistant: string;
  timestamp: Date;
}

const MOTIVATIONAL_QUOTES = [
  "The only bad workout is the one that didn't happen.",
  "Progress, not perfection.",
  "Strong is not about how much you can lift, it's about how much you can overcome.",
  "Every rep counts. Every set matters.",
  "The pain you feel today will be the strength you feel tomorrow.",
];

const FORM_TIP_TRIGGERS = ['form', 'technique', 'how to', 'proper', 'correct'];
const MOTIVATION_TRIGGERS = ['motivate', 'encourage', 'give up', 'tired', 'lazy', 'stuck'];
const PROGRESS_TRIGGERS = ['progress', 'improve', 'advance', 'level up', 'next'];

export class ChatService {
  private conversationMemory: Map<string, ConversationTurn[]> = new Map();
  private readonly MAX_MEMORY = 20;

  async processMessage(
    userMessage: string,
    context: ChatContext
  ): Promise<AIResponse> {
    const { userId, userProfile, conversationHistory } = context;
    
    this.addToMemory(userId, userMessage, '');

    const messageLower = userMessage.toLowerCase();
    
    if (this.isFormQuestion(messageLower)) {
      return this.handleFormQuestion(messageLower, context);
    }
    
    if (this.isMotivationRequest(messageLower)) {
      return this.handleMotivationRequest(context);
    }
    
    if (this.isProgressQuestion(messageLower)) {
      return this.handleProgressQuestion(context);
    }

    if (this.isProgramQuestion(messageLower)) {
      return this.handleProgramQuestion(context);
    }

    return this.handleGeneralChat(userMessage, context);
  }

  private isFormQuestion(message: string): boolean {
    return FORM_TIP_TRIGGERS.some(trigger => message.includes(trigger));
  }

  private isMotivationRequest(message: string): boolean {
    return MOTIVATION_TRIGGERS.some(trigger => message.includes(trigger));
  }

  private isProgressQuestion(message: string): boolean {
    return PROGRESS_TRIGGERS.some(trigger => message.includes(trigger));
  }

  private isProgramQuestion(message: string): boolean {
    return message.includes('program') || message.includes('routine') || message.includes('workout plan');
  }

  private async handleFormQuestion(
    message: string,
    context: ChatContext
  ): Promise<AIResponse> {
    const exerciseMatch = this.extractExerciseName(message);
    
    if (exerciseMatch) {
      const exercise = await this.findExerciseInDb(exerciseMatch);
      const formTips = exercise?.instructions || this.getFallbackFormTips(exerciseMatch);
      const exerciseInfo = exercise?.description || null;
      
      return {
        message: `**${exerciseMatch} Form Tips:**\n\n${formTips}\n\n${
          exerciseInfo 
            ? `**Brief Description:** ${exerciseInfo}` 
            : ''
        }`,
        type: 'tip',
        metadata: {
          exerciseName: exerciseMatch,
          category: 'form',
          sourcedFromDb: !!exercise,
        },
      };
    }

    return {
      message: "I'd be happy to help with form tips! Which exercise would you like form guidance on?",
      type: 'tip',
      metadata: { category: 'form', needsClarification: true },
    };
  }

  private async findExerciseInDb(exerciseName: string): Promise<{ description: string | null; instructions: string | null } | null> {
    const normalized = exerciseName.toLowerCase().trim();
    const exercise = await prisma.exercise.findFirst({
      where: {
        OR: [
          { name: { equals: normalized } },
          { name: { startsWith: normalized } },
          { slug: normalized.replace(/\s+/g, '-') },
        ],
      },
      select: { description: true, instructions: true },
    });
    return exercise || null;
  }

  private getFallbackFormTips(exerciseName: string): string {
    return `General tips for ${exerciseName}:
• Focus on controlled movement throughout the full range of motion
• Maintain proper breathing — exhale on exertion, inhale on the eccentric
• Use appropriate weight that allows you to maintain form
• Stop if you feel sharp pain (not muscle discomfort)
• Warm up with lighter weights before your working sets`;
  }

  private extractExerciseName(message: string): string | null {
    const patterns = [
      /how to do (?:a )?(.+?)(?:\?|$)/i,
      /form (?:on |for )?(.+?)(?:\?|$)/i,
      /proper (.+?)(?:\?|$)/i,
      /correct (.+?)(?:\?|$)/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  private async handleMotivationRequest(context: ChatContext): Promise<AIResponse> {
    const recentWorkouts = await mcpService.getWorkoutHistory(context.userId, 14);
    const workoutCount = recentWorkouts.filter(w => w.isCompleted).length;
    
    const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
    
    let message = `💪 ${quote}\n\n`;
    
    if (workoutCount > 0) {
      message += `You've completed ${workoutCount} workout${workoutCount > 1 ? 's' : ''} in the last 2 weeks. `;
      
      if (workoutCount >= 4) {
        message += `That's solid consistency! Keep pushing.`;
      } else if (workoutCount >= 2) {
        message += `You're building momentum. Let's get you to 3-4 sessions this week!`;
      } else {
        message += `It's time to get back on track. Even one workout is better than none.`;
      }
    } else {
      message += `The hardest step is the first one. Get to the gym and start. Remember: action creates motivation, not the other way around.`;
    }

    return {
      message,
      type: 'motivation',
      metadata: {
        quoteIncluded: true,
        recentWorkouts: workoutCount,
      },
    };
  }

  private async handleProgressQuestion(context: ChatContext): Promise<AIResponse> {
    const profile = await mcpService.getUserProfile(context.userId);
    const recentWorkouts = await mcpService.getWorkoutHistory(context.userId, 30);
    
    const totalSets = recentWorkouts.reduce((sum, w) => sum + w.sets.length, 0);
    const avgWorkoutsPerWeek = profile.trainingHistory.averageWorkoutsPerWeek;
    const level = profile.level;
    
    let message = `📊 **Your Progress Summary:**\n\n`;
    message += `• Total workouts completed: ${profile.trainingHistory.totalWorkouts}\n`;
    message += `• Average frequency: ${avgWorkoutsPerWeek} workouts/week\n`;
    message += `• Recent activity: ${recentWorkouts.length} workouts logged\n`;
    message += `• Total sets logged: ${totalSets}\n\n`;
    
    message += this.getProgressAdvice(level, avgWorkoutsPerWeek);

    return {
      message,
      type: 'answer',
      metadata: {
        totalWorkouts: profile.trainingHistory.totalWorkouts,
        averageFrequency: avgWorkoutsPerWeek,
        category: 'progress',
      },
    };
  }

  private getProgressAdvice(level: string, frequency: number): string {
    if (frequency < 2) {
      return `**Advice:** Your training frequency is quite low. Try to build consistency with 2-3 sessions per week before increasing intensity.`;
    }
    
    if (level === 'beginner' && frequency >= 3) {
      return `**Advice:** Great frequency for a beginner! Focus on mastering the fundamentals and progressive overload.`;
    }
    
    if (level === 'intermediate' && frequency >= 4) {
      return `**Advice:** Solid frequency. Consider periodizing your training with deload weeks every 4-6 weeks.`;
    }
    
    return `**Advice:** Keep up the good work! Remember to track your RPE and adjust weights based on how you feel.`;
  }

  private async handleProgramQuestion(context: ChatContext): Promise<AIResponse> {
    const currentProgram = await mcpService.getCurrentProgram(context.userId);
    
    if (currentProgram) {
      return {
        message: `You have an active program: **${currentProgram.name}**\n\n` +
                 `• Duration: ${currentProgram.durationWeeks} weeks\n` +
                 `• Focus: ${currentProgram.goal}\n` +
                 `• Difficulty: ${currentProgram.difficulty}\n\n` +
                 `Would you like me to help adjust it, generate a new one, or answer questions about specific exercises?`,
        type: 'answer',
        metadata: {
          programId: currentProgram.id,
          programName: currentProgram.name,
          category: 'program',
        },
      };
    }

    return {
      message: `You don't have an active program yet. Would you like me to generate one? I can create a personalized program based on your goals (strength, hypertrophy, or general fitness), available equipment, and training frequency.`,
      type: 'answer',
      metadata: {
        noActiveProgram: true,
        category: 'program',
      },
    };
  }

  private async handleGeneralChat(
    userMessage: string,
    context: ChatContext
  ): Promise<AIResponse> {
    const systemPrompt = generateSystemPrompt({
      userName: context.userProfile.name,
      userLevel: context.userProfile.fitnessLevel,
      userGoal: context.userProfile.primaryGoal,
      measurementUnit: context.userProfile.preferredUnits,
      trainingAge: context.userProfile.experienceYears || 1,
      injuries: context.userProfile.injuries,
      equipment: context.userProfile.equipment,
    }) + '\n\n' + formCueLibrary;

    const formattedHistory = context.conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    formattedHistory.push({
      role: 'user',
      content: userMessage,
    });

    const { response } = await claudeService.chat(systemPrompt, formattedHistory, mcpTools);

    this.addToMemory(context.userId, userMessage, response);

    return {
      message: response,
      type: this.classifyResponseType(response),
      metadata: {
        category: 'general',
        timestamp: new Date().toISOString(),
      },
    };
  }

  private classifyResponseType(response: string): AIResponse['type'] {
    const lowerResponse = response.toLowerCase();
    
    if (lowerResponse.includes('tip') || lowerResponse.includes('form')) {
      return 'tip';
    }
    if (lowerResponse.includes('adjust') || lowerResponse.includes('change')) {
      return 'correction';
    }
    if (response.includes('```json') || response.includes('program')) {
      return 'program';
    }
    
    return 'answer';
  }

  private addToMemory(userId: string, userMessage: string, assistantResponse: string): void {
    if (!this.conversationMemory.has(userId)) {
      this.conversationMemory.set(userId, []);
    }

    const memory = this.conversationMemory.get(userId)!;
    memory.push({
      user: userMessage,
      assistant: assistantResponse,
      timestamp: new Date(),
    });

    if (memory.length > this.MAX_MEMORY) {
      memory.shift();
    }
  }

  getConversationSummary(userId: string): ConversationTurn[] {
    return this.conversationMemory.get(userId) || [];
  }

  clearMemory(userId: string): void {
    this.conversationMemory.delete(userId);
  }
}

export const chatService = new ChatService();
