'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Trash2, Plus, Save, GripVertical, Sparkles, History } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import PRCelebration from './PRCelebration'
import { suggestNextWorkout } from '@/lib/progressiveOverload'
import { useUnit } from '@/contexts/UnitContext'
import { convertWeight, convertToKg } from '@/lib/unitConversion'

type ExerciseSet = {
  weight: number
  reps: number
  rpe?: number
}

type Exercise = {
  id: string
  name: string
  sets: ExerciseSet[]
}

interface PRDetection {
  exerciseName: string
  detection: {
    isPersonalRecord: boolean
    type: 'weight' | 'volume' | 'reps' | null
    improvement: string
  }
}

export default function WorkoutForm() {
  const router = useRouter()
  const { weightUnit } = useUnit()
  const [workoutName, setWorkoutName] = useState('')
  const [workoutDate, setWorkoutDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [exercises, setExercises] = useState<Exercise[]>([
    { id: '1', name: '', sets: [{ weight: 0, reps: 0 }] }
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [personalRecords, setPersonalRecords] = useState<PRDetection[]>([])
  const [showPRCelebration, setShowPRCelebration] = useState(false)
  const [exerciseSuggestions, setExerciseSuggestions] = useState<Map<string, any>>(new Map())

  const addExercise = () => {
    setExercises([
      ...exercises,
      {
        id: String(Date.now()),
        name: '',
        sets: [{ weight: 0, reps: 0 }]
      }
    ])
  }

  const removeExercise = (id: string) => {
    if (exercises.length > 1) {
      setExercises(exercises.filter(exercise => exercise.id !== id))
    }
  }

  const updateExerciseName = async (id: string, name: string) => {
    setExercises(
      exercises.map(exercise => 
        exercise.id === id ? { ...exercise, name } : exercise
      )
    )

    // Fetch exercise history for auto-fill suggestion
    if (name.length >= 3) {
      try {
        const response = await fetch(`/api/progress/data?exercise=${encodeURIComponent(name)}&timeFrame=30days`)
        if (response.ok) {
          const data = await response.json()
          if (data.length > 0) {
            // Get the most recent workout
            const lastWorkout = data[data.length - 1]
            const suggestions = new Map(exerciseSuggestions)
            suggestions.set(id, {
              lastWorkout: lastWorkout,
              exerciseName: name
            })
            setExerciseSuggestions(suggestions)
          }
        }
      } catch (error) {
        // Silently fail - suggestions are optional
        console.log('Failed to fetch exercise suggestions:', error)
      }
    }
  }

  const loadSuggestedSets = (exerciseId: string) => {
    const suggestion = exerciseSuggestions.get(exerciseId)
    if (!suggestion) return

    const lastWorkout = suggestion.lastWorkout
    // Create suggested sets based on last workout
    const lastSets = [{
      weight: lastWorkout.weight || 0,
      reps: lastWorkout.reps || 0,
      rpe: lastWorkout.rpe || undefined
    }]

    const suggestedSets = suggestNextWorkout(lastSets)
    
    // Convert suggested sets to ExerciseSet format (removing null rpe values)
    const convertedSets: ExerciseSet[] = suggestedSets.map(set => ({
      weight: set.weight,
      reps: set.reps,
      rpe: set.rpe ?? undefined
    }))
    
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        return {
          ...ex,
          sets: convertedSets.length > 0 ? convertedSets : ex.sets
        }
      }
      return ex
    }))

    // Remove suggestion after using it
    const newSuggestions = new Map(exerciseSuggestions)
    newSuggestions.delete(exerciseId)
    setExerciseSuggestions(newSuggestions)
  }

  const addSet = (exerciseId: string) => {
    setExercises(
      exercises.map(exercise => 
        exercise.id === exerciseId 
          ? { 
              ...exercise, 
              sets: [...exercise.sets, { weight: 0, reps: 0 }] 
            } 
          : exercise
      )
    )
  }

  const removeSet = (exerciseId: string, setIndex: number) => {
    setExercises(
      exercises.map(exercise => {
        if (exercise.id !== exerciseId || exercise.sets.length <= 1) {
          return exercise
        }
        
        const newSets = [...exercise.sets]
        newSets.splice(setIndex, 1)
        return { ...exercise, sets: newSets }
      })
    )
  }

  const updateSet = (exerciseId: string, setIndex: number, field: 'weight' | 'reps' | 'rpe', value: number) => {
    setExercises(prevExercises => {
      return prevExercises.map(exercise => {
        if (exercise.id === exerciseId) {
          const updatedSets = [...exercise.sets]
          let numericValue = isNaN(value) ? 0 : value
          
          // Convert weight to kg for storage if user is entering in lbs
          if (field === 'weight' && weightUnit === 'lbs') {
            numericValue = convertToKg(numericValue, 'lbs')
          }
          
          updatedSets[setIndex] = {
            ...updatedSets[setIndex],
            [field]: numericValue
          }
          return {
            ...exercise,
            sets: updatedSets
          }
        }
        return exercise
      })
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!workoutName.trim()) {
      setError('Please enter a workout name')
      return
    }
    
    const validExercises = exercises.filter(exercise => exercise.name.trim())
    
    if (validExercises.length === 0) {
      setError('Please add at least one exercise with a name')
      return
    }
    
    try {
      setIsSubmitting(true)
      setError('')
      
      const response = await fetch('/api/workouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: workoutName,
          date: workoutDate,
          exercises: validExercises
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json() as { error: string }
        throw new Error(errorData.error || 'Error creating workout')
      }
      
      const data = await response.json()
      
      // Check for personal records
      if (data.personalRecords && data.personalRecords.length > 0) {
        setPersonalRecords(data.personalRecords)
        setShowPRCelebration(true)
      }
      
      // Reset form
      setWorkoutName('')
      setWorkoutDate(new Date().toISOString().split('T')[0])
      setExercises([{ id: '1', name: '', sets: [{ weight: 0, reps: 0 }] }])
      setExerciseSuggestions(new Map())
      
      // Refresh page to show new workout
      router.refresh()
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-destructive/15 border border-destructive/50 text-destructive p-4 rounded-lg text-sm flex items-center gap-2"
        >
          <span className="font-medium">{error}</span>
        </motion.div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-field">
          <label htmlFor="workout-name" className="block text-sm font-medium mb-2 text-foreground/90">
            Workout Name *
          </label>
          <Input
            id="workout-name"
            type="text"
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            placeholder="e.g., Push Day, Leg Day"
            className="h-11"
            required
          />
        </div>
        
        <div className="form-field">
          <label htmlFor="workout-date" className="block text-sm font-medium mb-2 text-foreground/90">
            Date *
          </label>
          <Input
            id="workout-date"
            type="date"
            value={workoutDate}
            onChange={(e) => setWorkoutDate(e.target.value)}
            className="h-11"
            required
          />
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Exercises</h3>
          <Button 
            type="button" 
            onClick={addExercise}
            size="sm"
            variant="outline"
            className="flex items-center gap-2 h-9"
          >
            <Plus className="h-4 w-4" /> Add Exercise
          </Button>
        </div>
        
        <AnimatePresence mode="popLayout">
          {exercises.map((exercise, exerciseIndex) => (
            <motion.div
              key={exercise.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-5 card-modern">
                <div className="flex flex-col space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-3">
                      <GripVertical className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <label htmlFor={`exercise-name-${exercise.id}`} className="block text-sm font-medium mb-2 text-foreground/90">
                        Exercise Name *
                      </label>
                      <Input
                        id={`exercise-name-${exercise.id}`}
                        type="text"
                        value={exercise.name}
                        onChange={(e) => updateExerciseName(exercise.id, e.target.value)}
                        placeholder="e.g., Bench Press, Squat"
                        className="h-10"
                      />
                      {exerciseSuggestions.has(exercise.id) && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2"
                        >
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => loadSuggestedSets(exercise.id)}
                            className="h-8 text-xs border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Load Suggested Workout
                          </Button>
                        </motion.div>
                      )}
                    </div>
                    
                    <Button
                      type="button"
                      onClick={() => removeExercise(exercise.id)}
                      disabled={exercises.length <= 1}
                      size="sm"
                      variant="ghost"
                      className="mt-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-medium text-foreground/80">Sets</h4>
                      <Button
                        type="button"
                        onClick={() => addSet(exercise.id)}
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add Set
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="grid grid-cols-[40px_1fr_1fr_1fr_40px] gap-2 text-xs font-medium text-muted-foreground px-2">
                        <div>Set</div>
                        <div>Weight ({weightUnit})</div>
                        <div>Reps</div>
                        <div>RPE</div>
                        <div></div>
                      </div>
                      
                      <AnimatePresence mode="popLayout">
                        {exercise.sets.map((set, setIndex) => (
                          <motion.div
                            key={setIndex}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="grid grid-cols-[40px_1fr_1fr_1fr_40px] gap-2 items-center"
                          >
                            <div className="text-sm text-center font-medium text-muted-foreground">
                              {setIndex + 1}
                            </div>
                            <Input
                              type="number"
                              min="0"
                              step={weightUnit === 'kg' ? '0.5' : '1'}
                              value={set.weight ? convertWeight(set.weight, weightUnit) : ''}
                              onChange={(e) => updateSet(exercise.id, setIndex, 'weight', parseFloat(e.target.value) || 0)}
                              className="h-9 text-center"
                              placeholder={weightUnit === 'kg' ? '60' : '135'}
                            />
                            <Input
                              type="number"
                              min="0"
                              value={set.reps || ''}
                              onChange={(e) => updateSet(exercise.id, setIndex, 'reps', parseInt(e.target.value) || 0)}
                              className="h-9 text-center"
                              placeholder="10"
                            />
                            <Input
                              type="number"
                              min="0"
                              max="10"
                              step="0.5"
                              value={set.rpe !== undefined ? set.rpe : ''}
                              onChange={(e) => updateSet(exercise.id, setIndex, 'rpe', parseFloat(e.target.value) || 0)}
                              className="h-9 text-center"
                              placeholder="7-10"
                            />
                            <Button
                              type="button"
                              onClick={() => removeSet(exercise.id, setIndex)}
                              disabled={exercise.sets.length <= 1}
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      <div className="flex gap-3 pt-4">
        <Button 
          type="submit" 
          disabled={isSubmitting}
          size="lg"
          className="flex-1 md:flex-initial md:min-w-[200px] btn-glow h-12"
        >
          {isSubmitting ? (
            <>
              <div className="loading-spinner h-4 w-4 mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Workout
            </>
          )}
        </Button>
      </div>

      {/* PR Celebration Modal */}
      <PRCelebration
        personalRecords={personalRecords}
        isOpen={showPRCelebration}
        onClose={() => setShowPRCelebration(false)}
      />
    </form>
  )
}

