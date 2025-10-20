'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, Calendar, Search, Dumbbell, Filter } from 'lucide-react'
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

interface WorkoutsClientProps {
  workouts: Workout[]
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
}

export default function WorkoutsClient({ workouts }: WorkoutsClientProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<string>('all')

  // Filter workouts based on search and date
  const filteredWorkouts = workouts.filter((workout) => {
    const matchesSearch = workout.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workout.exercises.some(ex => ex.name.toLowerCase().includes(searchTerm.toLowerCase()))
    
    if (selectedMonth === 'all') return matchesSearch
    
    const workoutDate = new Date(workout.date)
    const workoutMonth = `${workoutDate.getFullYear()}-${String(workoutDate.getMonth() + 1).padStart(2, '0')}`
    return matchesSearch && workoutMonth === selectedMonth
  })

  // Get unique months from workouts for filtering
  const uniqueMonths = Array.from(new Set(workouts.map((w) => {
    const date = new Date(w.date)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }))).sort().reverse()

  return (
    <div className="container mx-auto py-6 md:py-8 px-4 md:px-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight gradient-text mb-2">
          All Workouts
        </h1>
        <p className="text-muted-foreground">
          View and manage your complete workout history
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-6 flex flex-col sm:flex-row gap-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search workouts or exercises..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-4 py-2 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Months</option>
          {uniqueMonths.map((month) => {
            const [year, monthNum] = month.split('-')
            const date = new Date(parseInt(year), parseInt(monthNum) - 1)
            return (
              <option key={month} value={month}>
                {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </option>
            )
          })}
        </select>
      </motion.div>

      {/* Workouts Grid */}
      {filteredWorkouts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center py-20 px-6 card-modern rounded-xl"
        >
          <div className="bg-primary/10 rounded-full p-6 inline-block mb-6">
            <Calendar className="h-12 w-12 text-primary/80" />
          </div>
          <h3 className="text-2xl font-semibold mb-3">
            {searchTerm || selectedMonth !== 'all' ? 'No Matching Workouts' : 'No Workouts Yet!'}
          </h3>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto text-lg">
            {searchTerm || selectedMonth !== 'all' 
              ? 'Try adjusting your search or filters to find what you\'re looking for.'
              : 'Start logging your training sessions to track your progress.'}
          </p>
          {!searchTerm && selectedMonth === 'all' && (
            <Button asChild size="lg" className="btn-glow">
              <Link href="/dashboard">
                <Dumbbell className="h-5 w-5 mr-2" />
                Go to Dashboard
              </Link>
            </Button>
          )}
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <AnimatePresence>
            {filteredWorkouts.map((workout: Workout) => {
              const totalSets = workout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
              const totalVolume = workout.exercises.reduce((acc, ex) => 
                acc + ex.sets.reduce((setAcc, set) => setAcc + (set.weight * set.reps), 0), 0
              )

              return (
                <motion.div key={workout.id} variants={itemVariants} layout>
                  <Card className="card-modern h-full flex flex-col">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <CardTitle className="text-xl font-bold text-primary leading-tight">
                          {workout.name}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground whitespace-nowrap px-2 py-1 bg-background/50 rounded-md">
                          {new Date(workout.date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
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
          </AnimatePresence>
        </motion.div>
      )}

      {/* Summary Stats */}
      {filteredWorkouts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex justify-center gap-8 text-sm text-muted-foreground"
        >
          <div>
            <span className="font-semibold text-foreground">{filteredWorkouts.length}</span> workouts shown
          </div>
          <div>
            <span className="font-semibold text-foreground">{workouts.length}</span> total workouts
          </div>
        </motion.div>
      )}
    </div>
  )
}

