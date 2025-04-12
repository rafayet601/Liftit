'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Trash2, Plus } from 'lucide-react'

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

interface WorkoutFormProps {
  onSuccess?: () => void;
}

export default function WorkoutForm({ onSuccess }: WorkoutFormProps) {
  const router = useRouter()
  const [workoutName, setWorkoutName] = useState('')
  const [workoutDate, setWorkoutDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [exercises, setExercises] = useState<Exercise[]>([
    { id: '1', name: '', sets: [{ weight: 0, reps: 0 }] }
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Add a new exercise
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

  // Remove an exercise
  const removeExercise = (id: string) => {
    if (exercises.length > 1) {
      setExercises(exercises.filter(exercise => exercise.id !== id))
    }
  }

  // Update exercise name
  const updateExerciseName = (id: string, name: string) => {
    setExercises(
      exercises.map(exercise => 
        exercise.id === id ? { ...exercise, name } : exercise
      )
    )
  }

  // Add a set to an exercise
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

  // Remove a set from an exercise
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

  // Update set details
  const updateSet = (exerciseId: string, setIndex: number, field: 'weight' | 'reps' | 'rpe', value: string | number) => {
    setExercises(prevExercises => {
      return prevExercises.map(exercise => {
        if (exercise.id === exerciseId) {
          const updatedSets = [...exercise.sets];
          // Ensure value is a valid number
          const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
          updatedSets[setIndex] = {
            ...updatedSets[setIndex],
            [field]: numericValue
          };
          return {
            ...exercise,
            sets: updatedSets
          };
        }
        return exercise;
      });
    });
  };

  // Submit the workout
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form
    if (!workoutName.trim()) {
      setError('Please enter a workout name')
      return
    }
    
    if (!exercises.some(exercise => exercise.name.trim())) {
      setError('Please add at least one exercise with a name')
      return
    }
    
    // Filter out any exercises without names
    const validExercises = exercises.filter(exercise => exercise.name.trim())
    
    if (validExercises.length === 0) {
      setError('Please add at least one valid exercise')
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
        throw new Error('Failed to create workout')
      }
      
      // Reset form
      setWorkoutName('')
      setWorkoutDate(new Date().toISOString().split('T')[0])
      setExercises([{ id: '1', name: '', sets: [{ weight: 0, reps: 0 }] }])
      
      // Refresh page to show new workout
      router.refresh()
      
      // Call onSuccess callback if provided
      onSuccess?.()
      
    } catch (err) {
      console.error('Error creating workout:', err)
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
      {error && <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm">{error}</div>}
      
      <div className="space-y-4">
        <div className="animate-slide-up">
          <label htmlFor="workout-name" className="block text-sm font-medium text-gray-700">
            Workout Name
          </label>
          <Input
            id="workout-name"
            type="text"
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            placeholder="e.g., Leg Day, Upper Body, etc."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>
        
        <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <label htmlFor="workout-date" className="block text-sm font-medium text-gray-700">
            Date
          </label>
          <Input
            id="workout-date"
            type="date"
            value={workoutDate}
            onChange={(e) => setWorkoutDate(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-lg font-medium">Exercises</h3>
          <Button 
            type="button" 
            onClick={addExercise}
            size="sm"
            variant="outline"
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" /> Add Exercise
          </Button>
        </div>
        
        {exercises.map((exercise, exerciseIndex) => (
          <Card key={exercise.id} className="p-4 border rounded-lg animate-scale-in" style={{ animationDelay: `${0.2 + exerciseIndex * 0.1}s` }}>
            <div className="flex flex-col space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <label htmlFor={`exercise-name-${exercise.id}`} className="block text-sm font-medium mb-1">
                    Exercise Name
                  </label>
                  <Input
                    id={`exercise-name-${exercise.id}`}
                    type="text"
                    value={exercise.name}
                    onChange={(e) => updateExerciseName(exercise.id, e.target.value)}
                    placeholder="e.g., Squat, Bench Press, etc."
                    className="w-full"
                  />
                </div>
                
                <Button
                  type="button"
                  onClick={() => removeExercise(exercise.id)}
                  disabled={exercises.length <= 1}
                  size="sm"
                  variant="ghost"
                  className="mt-6 ml-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium">Sets</h4>
                  <Button
                    type="button"
                    onClick={() => addSet(exercise.id)}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                  >
                    Add Set
                  </Button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-2 py-1 text-left font-medium">Set</th>
                        <th className="px-2 py-1 text-left font-medium">Weight (kg)</th>
                        <th className="px-2 py-1 text-left font-medium">Reps</th>
                        <th className="px-2 py-1 text-left font-medium">RPE (optional)</th>
                        <th className="px-2 py-1 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {exercise.sets.map((set, setIndex) => (
                        <tr key={setIndex} className="border-b border-opacity-50">
                          <td className="px-2 py-2">{setIndex + 1}</td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={set.weight}
                              onChange={(e) => updateSet(exercise.id, setIndex, 'weight', e.target.value)}
                              className="border rounded p-1 w-full text-sm"
                              min="0"
                              step="1.25"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={set.reps}
                              onChange={(e) => updateSet(exercise.id, setIndex, 'reps', e.target.value)}
                              className="border rounded p-1 w-full text-sm"
                              min="0"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={set.rpe || ''}
                              onChange={(e) => updateSet(exercise.id, setIndex, 'rpe', e.target.value)}
                              className="border rounded p-1 w-full text-sm"
                              min="0"
                              max="10"
                              step="0.5"
                              placeholder="RPE"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Button
                              type="button"
                              onClick={() => removeSet(exercise.id, setIndex)}
                              disabled={exercise.sets.length <= 1}
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      
      <div className="flex justify-end space-x-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
        <Button 
          type="submit" 
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {isSubmitting ? 'Saving...' : 'Save Workout'}
        </Button>
      </div>
    </form>
  )
} 