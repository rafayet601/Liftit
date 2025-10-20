'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import WorkoutForm from '@/components/WorkoutForm'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, PlusCircle, Eye, ChevronRight, Calendar, BarChart, Dumbbell, Trophy, Target } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Set {
  id: string
  weight: number
  reps: number
  rpe?: number | null
}

interface Exercise {
  id: string
  name: string
  sets: Set[]
}

interface Workout {
  id: string
  name: string
  date: Date
  exercises: Exercise[]
  duration?: number | null
}

interface DashboardStats {
  totalWorkouts: number
  recentWorkouts: number
  uniqueExercises: number
}

interface DashboardClientProps {
  workouts: Workout[]
  stats: DashboardStats
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
  show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
}

export default function DashboardClient({ workouts, stats }: DashboardClientProps) {
  const [isFormVisible, setIsFormVisible] = useState(false)
  
  return (
    <div className="container mx-auto py-6 md:py-8 px-4 md:px-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-6 mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight gradient-text mb-2">
              Workout Dashboard
            </h1>
            <p className="text-muted-foreground">
              Track your progress and log your latest workouts
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button 
              size="lg"
              className="btn-glow h-12"
              onClick={() => setIsFormVisible(!isFormVisible)}
            >
              <PlusCircle className="h-5 w-5 mr-2" />
              {isFormVisible ? 'Hide Form' : 'Log Workout'}
            </Button>
          </motion.div>
        </div>

        {/* Stats Cards */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <motion.div variants={itemVariants}>
            <Card className="card-modern stat-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Total Workouts
                    </p>
                    <p className="text-3xl font-bold">{stats.totalWorkouts}</p>
                  </div>
                  <div className="bg-primary/10 p-3 rounded-xl">
                    <Dumbbell className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="card-modern stat-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Last 30 Days
                    </p>
                    <p className="text-3xl font-bold">{stats.recentWorkouts}</p>
                  </div>
                  <div className="bg-accent/10 p-3 rounded-xl">
                    <Target className="h-6 w-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="card-modern stat-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Unique Exercises
                    </p>
                    <p className="text-3xl font-bold">{stats.uniqueExercises}</p>
                  </div>
                  <div className="bg-primary/10 p-3 rounded-xl">
                    <Trophy className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>
      
      {/* Add New Workout Form Card */}
      <AnimatePresence>
        {isFormVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: '2rem' }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="card-modern border-glow shadow-2xl">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <PlusCircle className="h-6 w-6 text-primary" />
                  Log a New Workout
                </CardTitle>
                <CardDescription className="text-base pt-1">
                  Track your latest training session and monitor your progress
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WorkoutForm />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Recent Workouts Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Recent Workouts</h2>
          <Button variant="ghost" asChild className="text-muted-foreground hover:text-primary">
            <Link href="/workouts" className="flex items-center gap-1">
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        
        {!workouts || workouts.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center py-20 px-6 card-modern rounded-xl"
          >
            <div className="bg-primary/10 rounded-full p-6 inline-block mb-6">
              <Calendar className="h-12 w-12 text-primary/80" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">No Workouts Yet!</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto text-lg">
              Start logging your training sessions to track your progress and visualize your fitness journey.
            </p>
            <Button onClick={() => setIsFormVisible(true)} size="lg" className="btn-glow">
              <PlusCircle className="h-5 w-5 mr-2" />
              Log Your First Workout
            </Button>
          </motion.div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {workouts.map((workout: Workout) => {
              const totalSets = workout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
              const totalVolume = workout.exercises.reduce((acc, ex) => 
                acc + ex.sets.reduce((setAcc, set) => setAcc + (set.weight * set.reps), 0), 0
              )

              return (
                <motion.div key={workout.id} variants={itemVariants}>
                  <Card className="card-modern h-full flex flex-col">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <CardTitle className="text-xl font-bold text-primary leading-tight">
                          {workout.name}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground whitespace-nowrap px-2 py-1 bg-background/50 rounded-md">
                          {new Date(workout.date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>{workout.exercises.length} exercises</span>
                        <span>•</span>
                        <span>{totalSets} sets</span>
                        {workout.duration && (
                          <>
                            <span>•</span>
                            <span>{workout.duration}min</span>
                          </>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow pb-4">
                      <ul className="space-y-2 mb-6">
                        {workout.exercises.slice(0, 4).map((exercise: Exercise) => {
                          const maxWeight = Math.max(...exercise.sets.map(s => s.weight))
                          return (
                            <li key={exercise.id} className="flex justify-between items-center text-sm">
                              <span className="text-foreground/90">{exercise.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-md font-medium">
                                  {exercise.sets.length}×
                                </span>
                                {maxWeight > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {maxWeight}kg
                                  </span>
                                )}
                              </div>
                            </li>
                          )
                        })}
                        {workout.exercises.length > 4 && (
                          <li className="text-xs text-muted-foreground/80 pt-1 text-center">
                            + {workout.exercises.length - 4} more exercises
                          </li>
                        )}
                      </ul>
                      {totalVolume > 0 && (
                        <div className="mt-auto pt-4 border-t border-border/30">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Total Volume</span>
                            <span className="font-semibold text-accent">{Math.round(totalVolume)}kg</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                    <div className="mt-auto border-t border-border/30 bg-background/20 px-4 py-3">
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button variant="ghost" size="sm" asChild className="w-full text-primary hover:text-primary hover:bg-primary/10">
                          <Link href={`/workouts/${workout.id}`} className="flex items-center justify-center">
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </Button>
                      </motion.div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </section>

      {/* Quick Actions */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <Card className="card-modern cursor-pointer" onClick={() => window.location.href = '/progress'}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-4 rounded-xl">
                <BarChart className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">View Progress</h3>
                <p className="text-sm text-muted-foreground">
                  Analyze your strength gains and workout trends
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-modern cursor-pointer" onClick={() => window.location.href = '/exercises'}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-accent/10 p-4 rounded-xl">
                <Dumbbell className="h-8 w-8 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Exercise Library</h3>
                <p className="text-sm text-muted-foreground">
                  Browse exercises and find new movements
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

