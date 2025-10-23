/**
 * Voice Command Parser
 * Parses natural language voice commands into structured workout data
 */

export interface ParsedVoiceCommand {
  weight?: number
  reps?: number
  rpe?: number
  unit?: 'kg' | 'lbs'
  exerciseName?: string
  action?: 'add_set' | 'add_exercise' | 'next_set' | 'stop' | 'cancel' | 'same_weight' | 'increase'
  modifier?: number // For commands like "increase by 5"
  confidence: number
  rawTranscript: string
}

/**
 * Parse voice transcript into workout command
 */
export function parseVoiceCommand(transcript: string): ParsedVoiceCommand {
  const normalizedText = transcript.toLowerCase().trim()
  const result: ParsedVoiceCommand = {
    confidence: 0,
    rawTranscript: transcript
  }

  // Control commands
  if (normalizedText.match(/\b(done|stop|finish|end)\b/)) {
    result.action = 'stop'
    result.confidence = 1.0
    return result
  }

  if (normalizedText.match(/\b(cancel|discard|nevermind|never mind)\b/)) {
    result.action = 'cancel'
    result.confidence = 1.0
    return result
  }

  if (normalizedText.match(/\b(next set|next)\b/)) {
    result.action = 'next_set'
    result.confidence = 1.0
    return result
  }

  if (normalizedText.match(/\b(new exercise|add exercise)\b/)) {
    result.action = 'add_exercise'
    result.confidence = 0.9
    return result
  }

  // Special modifiers
  if (normalizedText.match(/\b(same weight|same)\b/)) {
    result.action = 'same_weight'
    result.confidence = 0.9
  }

  const increaseMatch = normalizedText.match(/\b(?:increase|add|up)\s+(?:by\s+)?(\d+(?:\.\d+)?)\b/)
  if (increaseMatch) {
    result.action = 'increase'
    result.modifier = parseFloat(increaseMatch[1])
    result.confidence = 0.9
  }

  // Parse weight with unit
  const weightPatterns = [
    // "100 kilos", "100 kg", "100kg"
    /(\d+(?:\.\d+)?)\s*(?:kilos?|kgs?|k)\b/i,
    // "225 pounds", "225 lbs", "225lb"
    /(\d+(?:\.\d+)?)\s*(?:pounds?|lbs?|l)\b/i,
  ]

  let weightValue: number | undefined
  let unit: 'kg' | 'lbs' | undefined

  for (const pattern of weightPatterns) {
    const match = normalizedText.match(pattern)
    if (match) {
      weightValue = parseFloat(match[1])
      // Determine unit from the matched text
      const unitText = normalizedText.substring(match.index! + match[1].length).trim()
      if (unitText.match(/^(?:pounds?|lbs?|l)\b/i)) {
        unit = 'lbs'
      } else if (unitText.match(/^(?:kilos?|kgs?|k)\b/i)) {
        unit = 'kg'
      }
      break
    }
  }

  // If no unit specified but number found before "reps", assume kg
  if (!weightValue) {
    const implicitWeightMatch = normalizedText.match(/(\d+(?:\.\d+)?)\s+(?:\d+\s+)?(?:reps?|repetitions?|times?)\b/)
    if (implicitWeightMatch) {
      weightValue = parseFloat(implicitWeightMatch[1])
      unit = 'kg' // Default to kg
    }
  }

  // If still no weight found, try to find any number at the beginning
  if (!weightValue) {
    const numberMatch = normalizedText.match(/^(\d+(?:\.\d+)?)/)
    if (numberMatch) {
      weightValue = parseFloat(numberMatch[1])
      unit = 'kg' // Default to kg
    }
  }

  if (weightValue !== undefined) {
    result.weight = weightValue
    result.unit = unit || 'kg'
    result.confidence += 0.4
  }

  // Parse reps
  const repsPatterns = [
    // "8 reps", "8 repetitions", "8 times"
    /(\d+)\s*(?:reps?|repetitions?|times?)\b/i,
    // Just a number after weight: "100 kg 8"
    /(?:kg|kilos?|lbs?|pounds?)\s+(\d+)(?:\s|$)/i,
    // Number at the end without unit
    /\b(\d+)$/,
  ]

  for (const pattern of repsPatterns) {
    const match = normalizedText.match(pattern)
    if (match && !result.reps) {
      const repsValue = parseInt(match[1], 10)
      // Sanity check: reps should be reasonable (1-100)
      if (repsValue >= 1 && repsValue <= 100) {
        result.reps = repsValue
        result.confidence += 0.4
        break
      }
    }
  }

  // If still no reps found, try to find any number that's not the weight
  if (!result.reps && weightValue !== undefined) {
    const allNumbers = normalizedText.match(/\d+(?:\.\d+)?/g)
    if (allNumbers && allNumbers.length > 1) {
      // Find the second number (first is weight)
      const secondNumber = parseInt(allNumbers[1], 10)
      if (secondNumber >= 1 && secondNumber <= 100) {
        result.reps = secondNumber
        result.confidence += 0.4
      }
    }
  }

  // Parse RPE (Rate of Perceived Exertion)
  const rpePatterns = [
    // "RPE 8", "RPE 7.5"
    /\b(?:rpe|rate)\s*(\d+(?:\.\d+)?)\b/i,
    // "at 8", "intensity 9"
    /\b(?:at|intensity)\s*(\d+(?:\.\d+)?)\b/i,
  ]

  for (const pattern of rpePatterns) {
    const match = normalizedText.match(pattern)
    if (match) {
      const rpeValue = parseFloat(match[1])
      // RPE should be between 1-10
      if (rpeValue >= 1 && rpeValue <= 10) {
        result.rpe = rpeValue
        result.confidence += 0.2
        break
      }
    }
  }

  // Parse exercise name (if preceded by "add")
  const exerciseNameMatch = normalizedText.match(/\b(?:add|new|start)\s+([a-z\s]+?)\s+(?:\d+|$)/)
  if (exerciseNameMatch) {
    const exerciseName = exerciseNameMatch[1].trim()
    // Filter out common words that aren't exercise names
    const stopWords = ['set', 'reps', 'rep', 'kg', 'kilos', 'pounds', 'lbs', 'rpe']
    const nameWords = exerciseName.split(/\s+/).filter(word => !stopWords.includes(word))
    
    if (nameWords.length > 0) {
      result.exerciseName = nameWords.join(' ')
      result.action = 'add_exercise'
      result.confidence += 0.3
    }
  }

  // Ensure confidence is between 0 and 1
  result.confidence = Math.min(result.confidence, 1.0)

  return result
}

/**
 * Validate parsed command has minimum required data
 */
export function isValidWorkoutCommand(command: ParsedVoiceCommand): boolean {
  // Control commands are always valid
  if (command.action && ['stop', 'cancel', 'next_set', 'add_exercise'].includes(command.action)) {
    return true
  }

  // For workout data, need at least weight and reps, or just RPE
  if (command.rpe !== undefined && command.rpe >= 1 && command.rpe <= 10) {
    return true
  }

  if (command.weight !== undefined && command.reps !== undefined) {
    return command.weight > 0 && command.reps > 0 && command.reps <= 100
  }

  // Modifier commands
  if (command.action === 'same_weight' || command.action === 'increase') {
    return true
  }

  // Commands with just reps (for RPE updates)
  if (command.reps !== undefined && command.reps > 0 && command.reps <= 100) {
    return true
  }

  return false
}

/**
 * Format parsed command into human-readable string
 */
export function formatParsedCommand(command: ParsedVoiceCommand): string {
  if (command.action === 'stop') return 'Stop listening'
  if (command.action === 'cancel') return 'Cancel input'
  if (command.action === 'next_set') return 'Next set'
  if (command.action === 'add_exercise') {
    return command.exerciseName 
      ? `Add exercise: ${command.exerciseName}`
      : 'Add new exercise'
  }
  if (command.action === 'same_weight') return 'Same weight as before'
  if (command.action === 'increase') {
    return `Increase by ${command.modifier || 0}${command.unit || 'kg'}`
  }

  const parts: string[] = []

  if (command.weight !== undefined) {
    parts.push(`${command.weight}${command.unit || 'kg'}`)
  }

  if (command.reps !== undefined) {
    parts.push(`${command.reps} reps`)
  }

  if (command.rpe !== undefined) {
    parts.push(`RPE ${command.rpe}`)
  }

  return parts.length > 0 ? parts.join(' × ') : 'No data parsed'
}

/**
 * Get suggestions for voice commands
 */
export function getVoiceCommandExamples(): string[] {
  return [
    '100 kilos 8 reps',
    '225 pounds 5 reps RPE 9',
    '80 kg 12 reps',
    'Same weight 10 reps',
    'Increase by 5',
    'RPE 8',
    'Next set',
    'Done'
  ]
}

/**
 * Test if transcript contains partial command (for interim results)
 */
export function hasPartialCommand(transcript: string): boolean {
  const normalizedText = transcript.toLowerCase().trim()
  
  // Has numbers (potential weight or reps)
  if (/\d+/.test(normalizedText)) return true
  
  // Has weight units
  if (/\b(?:kg|kilos?|lbs?|pounds?)\b/i.test(normalizedText)) return true
  
  // Has command words
  if (/\b(?:reps?|repetitions?|rpe|same|increase|next|done|stop)\b/i.test(normalizedText)) return true
  
  return false
}

