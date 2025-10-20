import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const exerciseName = searchParams.get('exercise')
    const timeFrame = searchParams.get('timeFrame') || '30days'

    if (!exerciseName) {
      return NextResponse.json(
        { error: 'Exercise name is required' },
        { status: 400 }
      )
    }

    // Calculate date range based on timeFrame
    const now = new Date()
    const daysMap: Record<string, number> = {
      '30days': 30,
      '90days': 90,
      '365days': 365,
    }
    const days = daysMap[timeFrame] || 30
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    // Fetch exercises with sets for the specific exercise name and time range
    const exercises = await prisma.exercise.findMany({
      where: {
        name: exerciseName,
        workout: {
          userId: session.user.id,
          date: {
            gte: startDate,
          },
        },
      },
      include: {
        sets: true,
        workout: {
          select: {
            date: true,
          },
        },
      },
      orderBy: {
        workout: {
          date: 'asc',
        },
      },
    })

    // Format data for charts
    const progressData = exercises.map(exercise => {
      const maxWeight = Math.max(...exercise.sets.map(s => s.weight))
      const maxReps = Math.max(...exercise.sets.map(s => s.reps))
      const totalVolume = exercise.sets.reduce((acc, set) => acc + (set.weight * set.reps), 0)

      return {
        date: exercise.workout.date,
        weight: maxWeight,
        reps: maxReps,
        volume: totalVolume,
        sets: exercise.sets.length,
      }
    })

    return NextResponse.json(progressData)
  } catch (error) {
    console.error('Error fetching progress data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch progress data' },
      { status: 500 }
    )
  }
}

