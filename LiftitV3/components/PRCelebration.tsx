'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, X, TrendingUp, Zap } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface PRDetection {
  exerciseName: string
  detection: {
    isPersonalRecord: boolean
    type: 'weight' | 'volume' | 'reps' | null
    improvement: string
  }
}

interface PRCelebrationProps {
  personalRecords: PRDetection[]
  isOpen: boolean
  onClose: () => void
}

export default function PRCelebration({ personalRecords, isOpen, onClose }: PRCelebrationProps) {
  if (!personalRecords || personalRecords.length === 0) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="pointer-events-auto w-full max-w-lg"
            >
              <Card className="card-modern border-primary/50 shadow-2xl shadow-primary/20 relative overflow-hidden">
                {/* Animated background effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 animate-pulse-slow" />
                
                {/* Confetti particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {[...Array(20)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        background: i % 3 === 0 ? 'hsl(var(--primary))' : i % 3 === 1 ? 'hsl(var(--accent))' : '#fbbf24',
                        left: `${Math.random() * 100}%`,
                        top: '-10%'
                      }}
                      animate={{
                        y: ['0vh', '110vh'],
                        x: [0, Math.random() * 100 - 50],
                        rotate: [0, Math.random() * 360],
                        opacity: [1, 0]
                      }}
                      transition={{
                        duration: 2 + Math.random() * 2,
                        repeat: Infinity,
                        delay: Math.random() * 2
                      }}
                    />
                  ))}
                </div>

                <CardHeader className="relative">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ 
                          rotate: [0, -10, 10, -10, 0],
                          scale: [1, 1.1, 1]
                        }}
                        transition={{ 
                          duration: 0.5,
                          repeat: Infinity,
                          repeatDelay: 2
                        }}
                        className="bg-primary/20 p-3 rounded-xl"
                      >
                        <Trophy className="h-8 w-8 text-primary" />
                      </motion.div>
                      <div>
                        <CardTitle className="text-2xl gradient-text">
                          Personal Record{personalRecords.length > 1 ? 's' : ''}!
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          You're getting stronger!
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClose}
                      className="h-8 w-8 p-0 hover:bg-background/50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="relative space-y-3">
                  {personalRecords.map((pr, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-background/80 backdrop-blur-sm rounded-lg p-4 border border-primary/20"
                    >
                      <div className="flex items-start gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg flex-shrink-0">
                          {pr.detection.type === 'weight' && <Zap className="h-5 w-5 text-primary" />}
                          {pr.detection.type === 'volume' && <TrendingUp className="h-5 w-5 text-primary" />}
                          {pr.detection.type === 'reps' && <TrendingUp className="h-5 w-5 text-accent" />}
                          {!pr.detection.type && <Trophy className="h-5 w-5 text-primary" />}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-1">
                            {pr.exerciseName}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {pr.detection.improvement}
                          </p>
                          {pr.detection.type && (
                            <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-md">
                              <span className="text-xs font-medium text-primary capitalize">
                                {pr.detection.type} PR
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: personalRecords.length * 0.1 + 0.3 }}
                    className="pt-4"
                  >
                    <Button 
                      onClick={onClose}
                      className="w-full btn-glow h-11"
                    >
                      Keep Crushing It!
                    </Button>
                  </motion.div>

                  <p className="text-xs text-center text-muted-foreground pt-2">
                    Your hard work is paying off. Stay consistent!
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

