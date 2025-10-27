export interface Set {
  id: string
  weight: number
  reps: number
  rpe?: number | null
  createdAt: Date
  updatedAt: Date
}

export interface Exercise {
  id: string
  name: string
  workoutId: string
  sets: Set[]
  notes?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Workout {
  id: string
  name: string
  date: Date
  userId: string
  exercises: Exercise[]
  notes?: string | null
  duration?: number | null
  createdAt: Date
  updatedAt: Date
}

export interface User {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ExerciseLibraryItem {
  name: string
  category: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  equipment: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  instructions?: string[]
}

export interface WorkoutTemplate {
  id: string
  name: string
  description: string
  exercises: {
    name: string
    sets: {
      weight: number
      reps: number
      rpe?: number
    }[]
  }[]
}

export interface ProgressData {
  date: string
  exercise: string
  weight: number
  reps: number
  volume: number
  oneRepMax: number
}

export interface PersonalRecord {
  exercise: string
  type: 'weight' | 'volume' | 'reps'
  value: number
  date: Date
  previousValue?: number
}

export interface PersonalRecordDetection {
  isPersonalRecord: boolean
  type: 'weight' | 'volume' | 'reps' | null
  improvement: string
}

export interface DeloadAlert {
  needed: boolean
  reason: string
  weeksSinceDeload?: number
  volumeDropPercentage?: number
  recommendedProtocol?: string
}

export interface ExerciseRecommendation {
  exerciseName: string
  lastWorkout: {
    date: Date
    sets: {
      weight: number
      reps: number
      rpe?: number | null
    }[]
    volume: number
  } | null
  suggestedWorkout: {
    sets: {
      weight: number
      reps: number
      rpe?: number | null
    }[]
    totalVolume: number
  }
  progressAnalysis: {
    volumeChange: number
    volumeChangePercentage: number
    suggestion: string
    isProgress: boolean
  } | null
  personalRecord?: PersonalRecordDetection
  deloadAlert?: DeloadAlert
  daysSinceLastWorkout?: number
}

export interface VoiceCommand {
  weight?: number
  reps?: number
  rpe?: number
  unit?: 'kg' | 'lbs'
  exerciseName?: string
  action?: 'add_set' | 'add_exercise' | 'next_set' | 'stop' | 'cancel' | 'same_weight' | 'increase'
  modifier?: number
  confidence: number
  rawTranscript: string
}

export type VoiceRecognitionStatus = 'idle' | 'listening' | 'processing' | 'error' | 'unsupported'

