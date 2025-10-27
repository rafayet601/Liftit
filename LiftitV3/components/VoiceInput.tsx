'use client'

import React, { useEffect, useState } from 'react'
import { Mic, MicOff, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition'
import { 
  parseVoiceCommand, 
  isValidWorkoutCommand, 
  formatParsedCommand, 
  ParsedVoiceCommand,
  getVoiceCommandExamples 
} from '@/lib/voiceCommandParser'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface VoiceInputProps {
  onCommandParsed: (command: ParsedVoiceCommand) => void
  onClose?: () => void
  currentWeight?: number
  currentReps?: number
  currentRpe?: number
  weightUnit?: 'kg' | 'lbs'
  continuousMode?: boolean
}

export function VoiceInput({ 
  onCommandParsed, 
  onClose,
  currentWeight,
  currentReps,
  currentRpe,
  weightUnit = 'kg',
  continuousMode = false
}: VoiceInputProps) {
  const [parsedCommand, setParsedCommand] = useState<ParsedVoiceCommand | null>(null)
  const [showExamples, setShowExamples] = useState(false)
  const [isContinuous, setIsContinuous] = useState(continuousMode)
  const [commandHistory, setCommandHistory] = useState<ParsedVoiceCommand[]>([])

  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    status,
    error,
    startListening,
    stopListening,
    resetTranscript
  } = useVoiceRecognition({
    continuous: isContinuous,
    interimResults: true,
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        const command = parseVoiceCommand(text)
        setParsedCommand(command)

        // Auto-submit if valid command
        if (isValidWorkoutCommand(command)) {
          // Handle special actions
          if (command.action === 'stop' || command.action === 'cancel') {
            handleCancel()
            return
          }

          // Apply modifiers based on current values
          if (command.action === 'same_weight' && currentWeight) {
            command.weight = currentWeight
            command.unit = weightUnit
          }

          if (command.action === 'increase' && currentWeight && command.modifier) {
            command.weight = currentWeight + command.modifier
            command.unit = weightUnit
          }

          // In continuous mode, add to history and keep listening
          if (isContinuous) {
            setCommandHistory(prev => [...prev, command])
            onCommandParsed(command)
            // Reset for next command but keep listening
            setTimeout(() => {
              resetTranscript()
              setParsedCommand(null)
            }, 1000)
          } else {
            // Single mode: auto-submit after short delay to show parsed result
            setTimeout(() => {
              onCommandParsed(command)
              handleClose()
            }, 800)
          }
        }
      }
    },
    onError: (errorMsg) => {
      console.error('Voice recognition error:', errorMsg)
    }
  })

  const handleClose = () => {
    stopListening()
    resetTranscript()
    setParsedCommand(null)
    onClose?.()
  }

  const handleCancel = () => {
    stopListening()
    resetTranscript()
    setParsedCommand(null)
    onClose?.()
  }

  const handleToggleListening = () => {
    if (isListening) {
      stopListening()
    } else {
      resetTranscript()
      setParsedCommand(null)
      startListening()
    }
  }

  const handleManualSubmit = () => {
    if (parsedCommand && isValidWorkoutCommand(parsedCommand)) {
      onCommandParsed(parsedCommand)
      handleClose()
    }
  }

  // Auto-start listening when component mounts (if supported)
  useEffect(() => {
    if (isSupported) {
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        if (!isListening) {
          startListening()
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isSupported])

  // Cleanup: stop listening when component unmounts
  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [stopListening])

  console.log('VoiceInput component state:', { isSupported, status, error })

  if (!isSupported) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Voice Input Not Supported</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your browser doesn&apos;t support voice recognition. Try Chrome, Edge, or Safari.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Status: {status}, Error: {error || 'None'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const displayTranscript = transcript || interimTranscript
  const isValid = parsedCommand && isValidWorkoutCommand(parsedCommand)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-primary/50 shadow-lg">
        <CardContent className="p-4 space-y-4">
          {/* Header with status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AnimatePresence mode="wait">
                {status === 'listening' && (
                  <motion.div
                    key="listening"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <div className="relative">
                      <Mic className="h-5 w-5 text-primary" />
                      <motion.div
                        className="absolute inset-0 rounded-full bg-primary/20"
                        animate={{
                          scale: [1, 1.5, 1],
                          opacity: [0.5, 0, 0.5]
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    </div>
                  </motion.div>
                )}
                {status === 'processing' && (
                  <motion.div
                    key="processing"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  </motion.div>
                )}
                {status === 'error' && (
                  <motion.div
                    key="error"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </motion.div>
                )}
                {status === 'idle' && (
                  <motion.div
                    key="idle"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <MicOff className="h-5 w-5 text-muted-foreground" />
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <p className="text-sm font-semibold">
                  {status === 'listening' && 'Listening...'}
                  {status === 'processing' && 'Processing...'}
                  {status === 'error' && 'Error'}
                  {status === 'idle' && 'Voice Input'}
                </p>
                {isListening && (
                  <p className="text-xs text-muted-foreground">Speak your command</p>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground"
            >
              Close
            </Button>
          </div>

          {/* Transcript Display */}
          <div className="min-h-[60px] p-3 rounded-lg bg-background/50 border border-border/50">
            {displayTranscript ? (
              <p className="text-sm">
                <span className={interimTranscript ? "text-muted-foreground italic" : ""}>
                  {displayTranscript}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {isListening ? "Say something like \"100 kg 8 reps\"..." : "Click the button to start"}
              </p>
            )}
          </div>

          {/* Parsed Command Preview */}
          <AnimatePresence>
            {parsedCommand && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-3 rounded-lg border ${
                  isValid 
                    ? 'bg-primary/10 border-primary/30' 
                    : 'bg-muted border-border'
                }`}
              >
                <div className="flex items-start gap-2">
                  {isValid ? (
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {formatParsedCommand(parsedCommand)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Confidence: {Math.round(parsedCommand.confidence * 100)}%
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 rounded-lg bg-destructive/10 border border-destructive/30"
            >
              <p className="text-sm text-destructive">{error}</p>
            </motion.div>
          )}

          {/* Continuous Mode Toggle */}
          {!isListening && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="continuous-mode"
                checked={isContinuous}
                onChange={(e) => setIsContinuous(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="continuous-mode" className="text-sm text-muted-foreground cursor-pointer">
                Continuous mode (log multiple sets)
              </label>
            </div>
          )}

          {/* Command History (Continuous Mode) */}
          {isContinuous && commandHistory.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Logged ({commandHistory.length}):
              </p>
              {commandHistory.map((cmd, idx) => (
                <p key={idx} className="text-xs text-foreground">
                  {idx + 1}. {formatParsedCommand(cmd)}
                </p>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleToggleListening}
              className={`flex-1 ${isListening ? 'bg-destructive hover:bg-destructive/90' : ''}`}
              variant={isListening ? 'default' : 'outline'}
            >
              {isListening ? (
                <>
                  <MicOff className="h-4 w-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  {isContinuous ? 'Start Continuous' : 'Start Listening'}
                </>
              )}
            </Button>

            {parsedCommand && isValid && !isContinuous && (
              <Button
                onClick={handleManualSubmit}
                className="flex-1 btn-glow"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Apply
              </Button>
            )}
          </div>

          {/* Examples Toggle */}
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
          >
            {showExamples ? 'Hide' : 'Show'} command examples
          </button>

          {/* Command Examples */}
          <AnimatePresence>
            {showExamples && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1"
              >
              <p className="text-xs font-semibold text-muted-foreground mb-2">Try saying:</p>
              {getVoiceCommandExamples().map((example, idx) => (
                <p key={idx} className="text-xs text-muted-foreground pl-3">
                  • &quot;{example}&quot;
                </p>
              ))}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * Compact Voice Input Button
 * Just a microphone button that opens the full voice input modal
 */
interface VoiceInputButtonProps {
  onCommandParsed: (command: ParsedVoiceCommand) => void
  currentWeight?: number
  currentReps?: number
  currentRpe?: number
  weightUnit?: 'kg' | 'lbs'
  className?: string
}

export function VoiceInputButton({ 
  onCommandParsed,
  currentWeight,
  currentReps,
  currentRpe,
  weightUnit,
  className = ''
}: VoiceInputButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Keyboard shortcut support (Ctrl/Cmd + Shift + V)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + V to open voice input
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault()
        // Find the focused input and get its parent set
        const activeElement = document.activeElement
        if (activeElement && activeElement.closest('[data-voice-button]')) {
          setIsOpen(true)
        }
      }
      
      // Escape to close
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, []) // Empty dependency array to prevent re-registration

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={`${className}`}
        title="Voice input (Ctrl+Shift+V) - Speak your set data"
        data-voice-button
      >
        <Mic className="h-4 w-4" />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
              <VoiceInput
                onCommandParsed={(command) => {
                  onCommandParsed(command)
                  setIsOpen(false)
                }}
                onClose={() => setIsOpen(false)}
                currentWeight={currentWeight}
                currentReps={currentReps}
                currentRpe={currentRpe}
                weightUnit={weightUnit}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

