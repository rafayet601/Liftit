import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import { detectPersonalRecord } from '@/lib/progressiveOverload'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workouts = await prisma.workout.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        exercises: {
          include: {
            sets: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    })

    return NextResponse.json(workouts)
  } catch (error) {
    console.error('Error fetching workouts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workouts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, date, exercises } = body

    if (!name || !date || !exercises || exercises.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create workout with exercises and sets
    const workout = await prisma.workout.create({
      data: {
        name,
        date: new Date(date),
        userId: session.user.id,
        exercises: {
          create: exercises.map((exercise: any) => ({
            name: exercise.name,
            sets: {
              create: exercise.sets.map((set: any) => ({
                weight: set.weight,
                reps: set.reps,
                rpe: set.rpe || null,
              })),
            },
          })),
        },
      },
      include: {
        exercises: {
          include: {
            sets: true,
          },
        },
      },
    })

    // Detect personal records for each exercise
    const prDetections: Array<{ exerciseName: string; detection: any }> = []

    for (const exercise of workout.exercises) {
      // Get historical workouts for this exercise (excluding current workout)
      const historicalExercises = await prisma.exercise.findMany({
        where: {
          name: exercise.name,
          workout: {
            userId: session.user.id,
            date: {
              lt: workout.date
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

      const currentSets = exercise.sets.map(set => ({
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe
      }))

      const historicalBestSets = historicalExercises.flatMap(ex => 
        ex.sets.map(set => ({
          weight: set.weight,
          reps: set.reps,
          rpe: set.rpe
        }))
      )

      const detection = detectPersonalRecord(currentSets, historicalBestSets)
      
      if (detection.isPersonalRecord) {
        prDetections.push({
          exerciseName: exercise.name,
          detection
        })
      }
    }

    return NextResponse.json({ 
      workout, 
      personalRecords: prDetections 
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating workout:', error)
    return NextResponse.json(
      { error: 'Failed to create workout' },
      { status: 500 }
    )
  }
}

