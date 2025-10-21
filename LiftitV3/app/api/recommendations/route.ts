import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import { 
  suggestNextWorkout, 
  analyzeProgress, 
  detectPersonalRecord, 
  calculateVolume,
  detectDeloadNeeded,
  WeeklyVolume
} from '@/lib/progressiveOverload'
import { ExerciseRecommendation } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all unique exercises for the user (last 60 days)
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    const exercises = await prisma.exercise.findMany({
      where: {
        workout: {
          userId: session.user.id,
          date: {
            gte: sixtyDaysAgo
          }
        }
      },
      include: {
        sets: true,
        workout: {
          select: {
            date: true
          }
        }
      },
      orderBy: {
        workout: {
          date: 'desc'
        }
      }
    })

    // Group exercises by name
    const exercisesByName = new Map<string, typeof exercises>()
    exercises.forEach(exercise => {
      const existing = exercisesByName.get(exercise.name) || []
      exercisesByName.set(exercise.name, [...existing, exercise])
    })

    // Generate recommendations for each unique exercise
    const recommendations: ExerciseRecommendation[] = []

    for (const [exerciseName, exerciseHistory] of exercisesByName.entries()) {
      if (exerciseHistory.length === 0) continue

      // Get the most recent workout for this exercise
      const lastExercise = exerciseHistory[0]
      const lastSets = lastExercise.sets.map(set => ({
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe
      }))

      // Get previous workout for comparison (if exists)
      const previousExercise = exerciseHistory[1]
      const previousSets = previousExercise?.sets.map(set => ({
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe
      })) || []

      // Generate suggestions
      const suggestedSets = suggestNextWorkout(lastSets)
      const progressAnalysis = previousSets.length > 0 
        ? analyzeProgress(lastSets, previousSets)
        : null

      // Get historical best for PR detection
      const allSets = exerciseHistory.flatMap(ex => ex.sets.map(set => ({
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe
      })))
      const historicalBest = allSets.slice(lastSets.length) // Exclude current workout
      const prDetection = detectPersonalRecord(lastSets, historicalBest)

      // Calculate days since last workout
      const lastWorkoutDate = new Date(lastExercise.workout.date)
      const daysSinceLastWorkout = Math.floor(
        (Date.now() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      recommendations.push({
        exerciseName,
        lastWorkout: {
          date: lastWorkoutDate,
          sets: lastSets,
          volume: calculateVolume(lastSets)
        },
        suggestedWorkout: {
          sets: suggestedSets,
          totalVolume: calculateVolume(suggestedSets)
        },
        progressAnalysis,
        personalRecord: prDetection.isPersonalRecord ? prDetection : undefined,
        daysSinceLastWorkout
      })
    }

    // Calculate weekly volumes for deload detection
    const allWorkouts = await prisma.workout.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: sixtyDaysAgo
        }
      },
      include: {
        exercises: {
          include: {
            sets: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    })

    // Group workouts by week
    const weeklyVolumes: WeeklyVolume[] = []
    const weekMap = new Map<string, { volume: number, rpeSum: number, rpeCount: number, workoutCount: number }>()

    allWorkouts.forEach(workout => {
      const date = new Date(workout.date)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay()) // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0)
      const weekKey = weekStart.toISOString()

      const weekData = weekMap.get(weekKey) || { volume: 0, rpeSum: 0, rpeCount: 0, workoutCount: 0 }
      
      workout.exercises.forEach(exercise => {
        const exerciseVolume = exercise.sets.reduce((sum, set) => sum + (set.weight * set.reps), 0)
        weekData.volume += exerciseVolume

        exercise.sets.forEach(set => {
          if (set.rpe !== null) {
            weekData.rpeSum += set.rpe
            weekData.rpeCount++
          }
        })
      })
      
      weekData.workoutCount++
      weekMap.set(weekKey, weekData)
    })

    weekMap.forEach((data, weekKey) => {
      weeklyVolumes.push({
        weekStartDate: new Date(weekKey),
        totalVolume: data.volume,
        averageRPE: data.rpeCount > 0 ? data.rpeSum / data.rpeCount : 0,
        workoutCount: data.workoutCount
      })
    })

    // Detect deload need
    const deloadAnalysis = detectDeloadNeeded(weeklyVolumes)

    // Sort recommendations by priority: 
    // 1. PRs first
    // 2. Haven't trained in a while
    // 3. Most recent
    recommendations.sort((a, b) => {
      if (a.personalRecord && !b.personalRecord) return -1
      if (!a.personalRecord && b.personalRecord) return 1
      if (a.daysSinceLastWorkout !== b.daysSinceLastWorkout) {
        return (b.daysSinceLastWorkout || 0) - (a.daysSinceLastWorkout || 0)
      }
      return 0
    })

    return NextResponse.json({
      recommendations,
      deloadAnalysis,
      totalExercises: exercisesByName.size
    })

  } catch (error) {
    console.error('Error generating recommendations:', error)
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    )
  }
}

