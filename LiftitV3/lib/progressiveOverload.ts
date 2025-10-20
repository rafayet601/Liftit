/**
 * Progressive Overload Calculation Utilities
 * Helps users track if they're making progress and suggests next workout targets
 */

export interface WorkoutSet {
  weight: number
  reps: number
  rpe?: number | null
}

export interface ProgressData {
  currentVolume: number
  previousVolume: number
  volumeChange: number
  volumeChangePercentage: number
  suggestion: string
  isProgress: boolean
}

/**
 * Calculate total volume for a set of exercises
 */
export function calculateVolume(sets: WorkoutSet[]): number {
  return sets.reduce((total, set) => total + (set.weight * set.reps), 0)
}

/**
 * Calculate one-rep max using Epley formula
 */
export function calculateOneRepMax(weight: number, reps: number): number {
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}

/**
 * Compare current workout to previous and provide suggestions
 */
export function analyzeProgress(
  currentSets: WorkoutSet[],
  previousSets: WorkoutSet[]
): ProgressData {
  const currentVolume = calculateVolume(currentSets)
  const previousVolume = calculateVolume(previousSets)
  const volumeChange = currentVolume - previousVolume
  const volumeChangePercentage = previousVolume > 0 
    ? Math.round((volumeChange / previousVolume) * 100) 
    : 0

  let suggestion = ''
  let isProgress = false

  if (volumeChange > 0) {
    isProgress = true
    suggestion = `Great job! You increased volume by ${volumeChangePercentage}%. Keep it up!`
  } else if (volumeChange === 0) {
    suggestion = `You maintained the same volume. Try increasing weight or reps next time.`
  } else {
    suggestion = `Volume decreased by ${Math.abs(volumeChangePercentage)}%. This might indicate fatigue or deload week.`
  }

  return {
    currentVolume,
    previousVolume,
    volumeChange,
    volumeChangePercentage,
    suggestion,
    isProgress
  }
}

/**
 * Suggest next workout targets based on current performance
 */
export function suggestNextWorkout(
  currentSets: WorkoutSet[],
  targetIncrease: number = 2.5
): WorkoutSet[] {
  // Find the heaviest set
  const heaviestSet = currentSets.reduce((prev, current) => 
    current.weight > prev.weight ? current : prev
  )

  // Calculate average RPE
  const setsWithRPE = currentSets.filter(set => set.rpe !== null && set.rpe !== undefined)
  const avgRPE = setsWithRPE.length > 0
    ? setsWithRPE.reduce((sum, set) => sum + (set.rpe || 0), 0) / setsWithRPE.length
    : 7

  // If average RPE is low (< 7), suggest weight increase
  // If average RPE is high (>= 8), suggest same weight or rep increase
  if (avgRPE < 7) {
    return currentSets.map(set => ({
      ...set,
      weight: set.weight + targetIncrease
    }))
  } else if (avgRPE >= 8) {
    return currentSets.map(set => ({
      ...set,
      reps: set.reps + 1
    }))
  }

  return currentSets
}

/**
 * Detect if user achieved a personal record
 */
export function detectPersonalRecord(
  currentSets: WorkoutSet[],
  historicalBestSets: WorkoutSet[]
): {
  isPersonalRecord: boolean
  type: 'weight' | 'volume' | 'reps' | null
  improvement: string
} {
  if (!historicalBestSets.length) {
    return {
      isPersonalRecord: true,
      type: null,
      improvement: 'First time performing this exercise!'
    }
  }

  const currentMaxWeight = Math.max(...currentSets.map(s => s.weight))
  const previousMaxWeight = Math.max(...historicalBestSets.map(s => s.weight))
  
  if (currentMaxWeight > previousMaxWeight) {
    return {
      isPersonalRecord: true,
      type: 'weight',
      improvement: `New weight PR: ${currentMaxWeight}kg (previous: ${previousMaxWeight}kg)`
    }
  }

  const currentVolume = calculateVolume(currentSets)
  const previousVolume = calculateVolume(historicalBestSets)
  
  if (currentVolume > previousVolume) {
    return {
      isPersonalRecord: true,
      type: 'volume',
      improvement: `New volume PR: ${currentVolume}kg (previous: ${previousVolume}kg)`
    }
  }

  const currentMaxReps = Math.max(...currentSets.map(s => s.reps))
  const previousMaxReps = Math.max(...historicalBestSets.map(s => s.reps))
  
  if (currentMaxReps > previousMaxReps) {
    return {
      isPersonalRecord: true,
      type: 'reps',
      improvement: `New reps PR: ${currentMaxReps} reps (previous: ${previousMaxReps} reps)`
    }
  }

  return {
    isPersonalRecord: false,
    type: null,
    improvement: ''
  }
}

