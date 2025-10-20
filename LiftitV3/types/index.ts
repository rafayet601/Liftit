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

