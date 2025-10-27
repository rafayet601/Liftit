'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mic, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const TUTORIAL_KEY = 'voice-input-tutorial-seen'

export function VoiceTutorialTooltip() {
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    // Check if user has seen the tutorial
    const hasSeenTutorial = localStorage.getItem(TUTORIAL_KEY)
    if (!hasSeenTutorial) {
      // Show tutorial after a short delay
      setTimeout(() => setShowTutorial(true), 2000)
    }
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(TUTORIAL_KEY, 'true')
    setShowTutorial(false)
  }

  const handleResetTutorial = () => {
    localStorage.removeItem(TUTORIAL_KEY)
    setShowTutorial(true)
  }

  return (
    <>
      {/* Reset Tutorial Button (for testing) */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleResetTutorial}
        className="fixed bottom-4 right-4 z-40 text-xs opacity-50 hover:opacity-100"
        title="Show voice input tutorial"
      >
        <Info className="h-3 w-3 mr-1" />
        Voice Help
      </Button>

      {/* Tutorial Overlay */}
      <AnimatePresence>
        {showTutorial && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={handleDismiss}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg"
            >
              <Card className="border-primary/50 shadow-xl">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <div className="bg-primary/10 p-2 rounded-lg">
                        <Mic className="h-5 w-5 text-primary" />
                      </div>
                      Voice Input Tutorial
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDismiss}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Use voice commands to log your workout sets hands-free! Perfect for when you&apos;re mid-workout.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs">1</span>
                        How to Use
                      </h4>
                      <p className="text-sm text-muted-foreground pl-7">
                        Click the <Mic className="inline h-3 w-3 mx-1" /> microphone button next to any set, then speak your command.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs">2</span>
                        Example Commands
                      </h4>
                      <div className="pl-7 space-y-1.5">
                        <p className="text-sm">
                          <code className="bg-muted px-2 py-0.5 rounded text-xs">&quot;100 kilos 8 reps&quot;</code>
                        </p>
                        <p className="text-sm">
                          <code className="bg-muted px-2 py-0.5 rounded text-xs">&quot;225 pounds 5 reps RPE 9&quot;</code>
                        </p>
                        <p className="text-sm">
                          <code className="bg-muted px-2 py-0.5 rounded text-xs">&quot;same weight 10 reps&quot;</code>
                        </p>
                        <p className="text-sm">
                          <code className="bg-muted px-2 py-0.5 rounded text-xs">&quot;RPE 8&quot;</code>
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs">3</span>
                        Supported Units
                      </h4>
                      <p className="text-sm text-muted-foreground pl-7">
                        Works with kg, kilos, lbs, and pounds. The app will automatically convert to your preferred unit.
                      </p>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">
                        <strong className="text-foreground">Pro tip:</strong> Voice recognition requires microphone access. 
                        Your browser will ask for permission the first time you use it. All processing happens locally - 
                        no audio is sent to servers.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleDismiss}
                      className="flex-1 btn-glow"
                    >
                      Got it!
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/**
 * Inline tooltip that appears near the voice button
 */
export function VoiceInputInlineTooltip({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-full left-0 mt-2 z-20 w-64"
    >
      <Card className="border-primary/50 shadow-lg">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary flex-shrink-0" />
              <p className="text-xs font-semibold">Voice Input</p>
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Click to speak: &quot;100 kg 8 reps RPE 7&quot;
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

