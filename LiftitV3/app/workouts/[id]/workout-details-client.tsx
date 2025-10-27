'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft, Calendar, Dumbbell, Edit, Trash2 } from 'lucide-react'
import DeleteWorkoutButton from '@/components/DeleteWorkoutButton'
import { useUnit } from '@/contexts/UnitContext'
import { convertWeight } from '@/lib/unitConversion'

// Define interfaces for types
interface Set {
  id: string;
  weight: number;
  reps: number;
  rpe: number | null;
}

interface Exercise {
  id: string;
  name: string;
  sets: Set[];
}

interface Workout {
  id: string;
  name: string;
  date: string | Date;
  exercises: Exercise[];
}

interface WorkoutDetailsClientProps {
  workout: Workout;
}

export default function WorkoutDetailsClient({ workout }: WorkoutDetailsClientProps) {
  const { weightUnit } = useUnit()

  // Calculate total volume for the workout
  const totalVolume = workout.exercises.reduce((acc, exercise) => {
    return acc + exercise.sets.reduce((setAcc, set) => {
      const weightInDisplayUnit = convertWeight(set.weight, weightUnit)
      return setAcc + (weightInDisplayUnit * set.reps)
    }, 0)
  }, 0)

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/workouts">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" />
              Back to Workouts
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{workout.name}</h1>
            <div className="flex items-center gap-4 text-muted-foreground mt-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(workout.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
              <div className="flex items-center gap-2">
                <Dumbbell className="w-4 h-4" />
                Total Volume: {totalVolume.toFixed(1)}{weightUnit}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/workouts/${workout.id}/edit`}>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Edit className="w-4 h-4" />
              Edit
            </Button>
          </Link>
          <DeleteWorkoutButton workoutId={workout.id} />
        </div>
      </div>

      {/* Exercises */}
      <div className="space-y-6">
        {workout.exercises.map((exercise, exerciseIndex) => {
          // Calculate total volume for this exercise
          const exerciseVolume = exercise.sets.reduce((sum, set) => {
            const weightInDisplayUnit = convertWeight(set.weight, weightUnit)
            return sum + (weightInDisplayUnit * set.reps)
          }, 0)

          return (
            <Card key={exercise.id} className="overflow-hidden">
              <CardHeader className="bg-muted/30">
                <CardTitle className="flex items-center justify-between">
                  <span>{exercise.name}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    Volume: {exerciseVolume.toFixed(1)}{weightUnit}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="text-left font-medium py-2 pl-4 text-muted-foreground">Set</th>
                        <th className="text-left font-medium py-2 pl-4 text-muted-foreground">Weight ({weightUnit})</th>
                        <th className="text-left font-medium py-2 pl-4 text-muted-foreground">Reps</th>
                        <th className="text-left font-medium py-2 pl-4 text-muted-foreground">Volume</th>
                        <th className="text-left font-medium py-2 pl-4 text-muted-foreground">RPE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exercise.sets.map((set: Set, index: number) => {
                        const weightInDisplayUnit = convertWeight(set.weight, weightUnit)
                        return (
                          <tr key={set.id} className="border-b border-border/30 hover:bg-background/40 transition-colors">
                            <td className="py-3 pr-4 font-medium">{index + 1}</td>
                            <td className="py-3 px-4">{weightInDisplayUnit}</td>
                            <td className="py-3 px-4">{set.reps}</td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {(weightInDisplayUnit * set.reps).toFixed(1)}
                            </td>
                            <td className="py-3 pl-4">
                              {set.rpe !== null ? (
                                <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                                  {set.rpe}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
