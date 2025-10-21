'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, TrendingUp, AlertTriangle, Trophy, Calendar, Target, Zap, Activity } from 'lucide-react'
import { motion } from 'framer-motion'
import { ExerciseRecommendation, DeloadAlert } from '@/types'

interface RecommendationsData {
  recommendations: ExerciseRecommendation[]
  deloadAnalysis: DeloadAlert
  totalExercises: number
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
}

export default function RecommendationsClient() {
  const [data, setData] = useState<RecommendationsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchRecommendations = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/recommendations')
        
        if (!response.ok) {
          throw new Error('Failed to fetch recommendations')
        }
        
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchRecommendations()
  }, [])

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="loading-spinner h-12 w-12 mb-4 mx-auto" />
              <p className="text-muted-foreground">Analyzing your training data...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <Card className="card-modern">
            <CardContent className="p-12 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Unable to Load Recommendations</h3>
              <p className="text-muted-foreground">{error || 'An unexpected error occurred'}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (data.recommendations.length === 0) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <Card className="card-modern">
            <CardContent className="p-12 text-center">
              <div className="bg-primary/10 rounded-full p-6 inline-block mb-6">
                <Activity className="h-12 w-12 text-primary/80" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">No Recommendations Yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Start logging your workouts to receive personalized training recommendations!
              </p>
              <Button asChild className="btn-glow">
                <a href="/dashboard">Log Your First Workout</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const readyToTrain = data.recommendations.filter(r => (r.daysSinceLastWorkout || 0) >= 2)
  const recentlyTrained = data.recommendations.filter(r => (r.daysSinceLastWorkout || 0) < 2)
  const hasProgress = data.recommendations.filter(r => r.progressAnalysis?.isProgress).length
  const hasPRs = data.recommendations.filter(r => r.personalRecord).length

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight gradient-text mb-3">
            Training Recommendations
          </h1>
          <p className="text-muted-foreground text-lg mb-6">
            AI-powered insights to help you progress faster and train smarter
          </p>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="card-modern">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{data.totalExercises}</p>
                    <p className="text-xs text-muted-foreground">Exercises</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="card-modern">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-accent" />
                  <div>
                    <p className="text-2xl font-bold">{hasProgress}</p>
                    <p className="text-xs text-muted-foreground">Progressing</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="card-modern">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{hasPRs}</p>
                    <p className="text-xs text-muted-foreground">Recent PRs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="card-modern">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-accent" />
                  <div>
                    <p className="text-2xl font-bold">{readyToTrain.length}</p>
                    <p className="text-xs text-muted-foreground">Ready</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Deload Alert */}
          {data.deloadAnalysis.needed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6"
            >
              <Card className="border-destructive/50 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Deload Week Recommended
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground/90 mb-3">{data.deloadAnalysis.reason}</p>
                  {data.deloadAnalysis.recommendedProtocol && (
                    <p className="text-sm text-muted-foreground bg-background/50 p-3 rounded-lg">
                      <strong>Protocol:</strong> {data.deloadAnalysis.recommendedProtocol}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>

        {/* Ready to Train Section */}
        {readyToTrain.length > 0 && (
          <motion.section 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="mb-8"
          >
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Zap className="h-6 w-6 text-accent" />
              Ready for Next Session
            </h2>
            <div className="grid gap-4">
              {readyToTrain.map((rec, index) => (
                <ExerciseRecommendationCard key={index} recommendation={rec} />
              ))}
            </div>
          </motion.section>
        )}

        {/* Recently Trained Section */}
        {recentlyTrained.length > 0 && (
          <motion.section 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="mb-8"
          >
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Recently Trained
            </h2>
            <div className="grid gap-4">
              {recentlyTrained.map((rec, index) => (
                <ExerciseRecommendationCard key={index} recommendation={rec} />
              ))}
            </div>
          </motion.section>
        )}
      </div>
    </div>
  )
}

function ExerciseRecommendationCard({ recommendation }: { recommendation: ExerciseRecommendation }) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="card-modern">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl flex items-center gap-2">
                {recommendation.exerciseName}
                {recommendation.personalRecord && (
                  <Trophy className="h-5 w-5 text-primary" />
                )}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4" />
                {recommendation.daysSinceLastWorkout === 0 && 'Trained today'}
                {recommendation.daysSinceLastWorkout === 1 && 'Trained yesterday'}
                {(recommendation.daysSinceLastWorkout || 0) > 1 && 
                  `${recommendation.daysSinceLastWorkout} days since last session`
                }
              </CardDescription>
            </div>
            <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Last Workout */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Last Workout</h4>
              <div className="space-y-2">
                {recommendation.lastWorkout?.sets.map((set, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm bg-background/50 p-2 rounded">
                    <span className="text-xs text-muted-foreground w-8">Set {i + 1}</span>
                    <span className="font-medium">{set.weight}kg × {set.reps}</span>
                    {set.rpe && (
                      <span className="text-xs text-muted-foreground ml-auto">RPE {set.rpe}</span>
                    )}
                  </div>
                ))}
                <div className="pt-2 border-t border-border/30">
                  <span className="text-xs text-muted-foreground">Total Volume: </span>
                  <span className="text-sm font-semibold">{recommendation.lastWorkout?.volume}kg</span>
                </div>
              </div>
            </div>

            {/* Suggested Workout */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-primary flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Suggested Next Session
              </h4>
              <div className="space-y-2">
                {recommendation.suggestedWorkout.sets.map((set, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm bg-primary/5 border border-primary/20 p-2 rounded">
                    <span className="text-xs text-muted-foreground w-8">Set {i + 1}</span>
                    <span className="font-medium text-primary">{set.weight}kg × {set.reps}</span>
                    {set.rpe && (
                      <span className="text-xs text-muted-foreground ml-auto">RPE {set.rpe}</span>
                    )}
                  </div>
                ))}
                <div className="pt-2 border-t border-primary/30">
                  <span className="text-xs text-muted-foreground">Target Volume: </span>
                  <span className="text-sm font-semibold text-primary">
                    {recommendation.suggestedWorkout.totalVolume}kg
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Analysis */}
          {recommendation.progressAnalysis && (
            <div className="mt-4 p-4 bg-background/50 rounded-lg border border-border/30">
              <p className="text-sm mb-2">
                <span className={recommendation.progressAnalysis.isProgress ? 'text-accent font-medium' : 'text-muted-foreground'}>
                  {recommendation.progressAnalysis.suggestion}
                </span>
              </p>
              {recommendation.progressAnalysis.volumeChangePercentage !== 0 && (
                <p className="text-xs text-muted-foreground">
                  Volume change: {recommendation.progressAnalysis.volumeChangePercentage > 0 ? '+' : ''}
                  {recommendation.progressAnalysis.volumeChangePercentage}%
                </p>
              )}
            </div>
          )}

          {/* PR Badge */}
          {recommendation.personalRecord && (
            <div className="mt-4 p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-5 w-5 text-primary" />
                <span className="font-semibold text-primary">Personal Record!</span>
              </div>
              <p className="text-sm">{recommendation.personalRecord.improvement}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

