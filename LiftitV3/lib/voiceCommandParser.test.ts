/**
 * Unit tests for voice command parser
 * Run with: npm test (once test framework is set up)
 */

import { 
  parseVoiceCommand, 
  isValidWorkoutCommand, 
  formatParsedCommand,
  hasPartialCommand
} from './voiceCommandParser'

describe('parseVoiceCommand', () => {
  describe('Weight and Reps parsing', () => {
    it('should parse basic kg command', () => {
      const result = parseVoiceCommand('100 kilos 8 reps')
      expect(result.weight).toBe(100)
      expect(result.reps).toBe(8)
      expect(result.unit).toBe('kg')
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('should parse basic lbs command', () => {
      const result = parseVoiceCommand('225 pounds 5 reps')
      expect(result.weight).toBe(225)
      expect(result.reps).toBe(5)
      expect(result.unit).toBe('lbs')
    })

    it('should parse kg shorthand', () => {
      const result = parseVoiceCommand('80 kg 10 reps')
      expect(result.weight).toBe(80)
      expect(result.reps).toBe(10)
      expect(result.unit).toBe('kg')
    })

    it('should parse lbs shorthand', () => {
      const result = parseVoiceCommand('135 lbs 8')
      expect(result.weight).toBe(135)
      expect(result.reps).toBe(8)
      expect(result.unit).toBe('lbs')
    })

    it('should handle decimal weights', () => {
      const result = parseVoiceCommand('67.5 kg 12 reps')
      expect(result.weight).toBe(67.5)
      expect(result.reps).toBe(12)
    })

    it('should parse without explicit "reps" keyword', () => {
      const result = parseVoiceCommand('100 kg 8')
      expect(result.weight).toBe(100)
      expect(result.reps).toBe(8)
    })
  })

  describe('RPE parsing', () => {
    it('should parse RPE with weight and reps', () => {
      const result = parseVoiceCommand('100 kg 8 reps RPE 9')
      expect(result.weight).toBe(100)
      expect(result.reps).toBe(8)
      expect(result.rpe).toBe(9)
    })

    it('should parse just RPE', () => {
      const result = parseVoiceCommand('RPE 7.5')
      expect(result.rpe).toBe(7.5)
    })

    it('should parse "rate" keyword', () => {
      const result = parseVoiceCommand('rate 8')
      expect(result.rpe).toBe(8)
    })

    it('should parse "intensity" keyword', () => {
      const result = parseVoiceCommand('intensity 9')
      expect(result.rpe).toBe(9)
    })

    it('should reject invalid RPE values', () => {
      const result = parseVoiceCommand('RPE 15')
      expect(result.rpe).toBeUndefined()
    })
  })

  describe('Control commands', () => {
    it('should parse stop command', () => {
      const result = parseVoiceCommand('done')
      expect(result.action).toBe('stop')
      expect(result.confidence).toBe(1.0)
    })

    it('should parse cancel command', () => {
      const result = parseVoiceCommand('cancel')
      expect(result.action).toBe('cancel')
    })

    it('should parse next set command', () => {
      const result = parseVoiceCommand('next set')
      expect(result.action).toBe('next_set')
    })

    it('should parse same weight command', () => {
      const result = parseVoiceCommand('same weight 10 reps')
      expect(result.action).toBe('same_weight')
    })

    it('should parse increase command', () => {
      const result = parseVoiceCommand('increase by 5')
      expect(result.action).toBe('increase')
      expect(result.modifier).toBe(5)
    })
  })

  describe('Case insensitivity', () => {
    it('should handle uppercase', () => {
      const result = parseVoiceCommand('100 KILOS 8 REPS')
      expect(result.weight).toBe(100)
      expect(result.reps).toBe(8)
    })

    it('should handle mixed case', () => {
      const result = parseVoiceCommand('100 Kilos 8 Reps RPE 8')
      expect(result.weight).toBe(100)
      expect(result.reps).toBe(8)
      expect(result.rpe).toBe(8)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const result = parseVoiceCommand('')
      expect(result.confidence).toBe(0)
    })

    it('should handle nonsense input', () => {
      const result = parseVoiceCommand('hello world')
      expect(result.confidence).toBe(0)
    })

    it('should handle extra whitespace', () => {
      const result = parseVoiceCommand('  100   kg   8   reps  ')
      expect(result.weight).toBe(100)
      expect(result.reps).toBe(8)
    })

    it('should store raw transcript', () => {
      const input = '100 kg 8 reps'
      const result = parseVoiceCommand(input)
      expect(result.rawTranscript).toBe(input)
    })
  })
})

describe('isValidWorkoutCommand', () => {
  it('should validate complete workout data', () => {
    const command = parseVoiceCommand('100 kg 8 reps')
    expect(isValidWorkoutCommand(command)).toBe(true)
  })

  it('should validate RPE-only command', () => {
    const command = parseVoiceCommand('RPE 8')
    expect(isValidWorkoutCommand(command)).toBe(true)
  })

  it('should validate control commands', () => {
    const stopCommand = parseVoiceCommand('done')
    expect(isValidWorkoutCommand(stopCommand)).toBe(true)

    const cancelCommand = parseVoiceCommand('cancel')
    expect(isValidWorkoutCommand(cancelCommand)).toBe(true)
  })

  it('should reject incomplete data', () => {
    const command = {
      weight: 100,
      unit: 'kg' as const,
      confidence: 0.5,
      rawTranscript: '100 kg'
    }
    expect(isValidWorkoutCommand(command)).toBe(false)
  })

  it('should reject invalid reps', () => {
    const command = {
      weight: 100,
      reps: 200, // unrealistic
      unit: 'kg' as const,
      confidence: 0.8,
      rawTranscript: '100 kg 200'
    }
    expect(isValidWorkoutCommand(command)).toBe(false)
  })
})

describe('formatParsedCommand', () => {
  it('should format weight and reps', () => {
    const command = parseVoiceCommand('100 kg 8 reps')
    const formatted = formatParsedCommand(command)
    expect(formatted).toContain('100kg')
    expect(formatted).toContain('8 reps')
  })

  it('should format with RPE', () => {
    const command = parseVoiceCommand('100 kg 8 reps RPE 9')
    const formatted = formatParsedCommand(command)
    expect(formatted).toContain('RPE 9')
  })

  it('should format control commands', () => {
    const stopCommand = parseVoiceCommand('done')
    expect(formatParsedCommand(stopCommand)).toBe('Stop listening')

    const cancelCommand = parseVoiceCommand('cancel')
    expect(formatParsedCommand(cancelCommand)).toBe('Cancel input')
  })

  it('should format same weight command', () => {
    const command = parseVoiceCommand('same weight')
    expect(formatParsedCommand(command)).toBe('Same weight as before')
  })

  it('should handle no data', () => {
    const command = parseVoiceCommand('hello')
    const formatted = formatParsedCommand(command)
    expect(formatted).toBe('No data parsed')
  })
})

describe('hasPartialCommand', () => {
  it('should detect numbers', () => {
    expect(hasPartialCommand('100')).toBe(true)
  })

  it('should detect units', () => {
    expect(hasPartialCommand('kg')).toBe(true)
    expect(hasPartialCommand('pounds')).toBe(true)
  })

  it('should detect command words', () => {
    expect(hasPartialCommand('reps')).toBe(true)
    expect(hasPartialCommand('RPE')).toBe(true)
  })

  it('should reject irrelevant text', () => {
    expect(hasPartialCommand('hello world')).toBe(false)
  })

  it('should handle empty string', () => {
    expect(hasPartialCommand('')).toBe(false)
  })
})

// Integration tests
describe('Voice Command Parser - Integration', () => {
  it('should handle realistic voice input variations', () => {
    const variations = [
      '100 kilos 8 reps',
      'hundred kilograms eight repetitions',
      '100kg 8',
      'one hundred kg eight reps',
    ]

    // At least the explicit numeric ones should work
    const result1 = parseVoiceCommand(variations[0])
    expect(result1.weight).toBe(100)
    expect(result1.reps).toBe(8)

    const result3 = parseVoiceCommand(variations[2])
    expect(result3.weight).toBe(100)
    expect(result3.reps).toBe(8)
  })

  it('should handle complex multi-part commands', () => {
    const result = parseVoiceCommand('bench press 225 pounds 5 reps RPE 9')
    // Exercise name parsing is optional/advanced feature
    expect(result.weight).toBe(225)
    expect(result.reps).toBe(5)
    expect(result.rpe).toBe(9)
    expect(result.unit).toBe('lbs')
  })
})

