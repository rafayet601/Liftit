import { getServerSession } from 'next-auth'
import { authOptions } from '../api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import DashboardClient from './dashboard-client'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  if (!session || !session.user) {
    redirect('/auth/signin')
  }

  // Fetch recent workouts for the user
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
    take: 10,
  })

  // Calculate some quick stats
  const totalWorkouts = await prisma.workout.count({
    where: {
      userId: session.user.id,
    },
  })

  const today = new Date()
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  
  const recentWorkouts = await prisma.workout.count({
    where: {
      userId: session.user.id,
      date: {
        gte: thirtyDaysAgo,
      },
    },
  })

  // Get unique exercises count
  const allExercises = await prisma.exercise.findMany({
    where: {
      workout: {
        is: { userId: session.user.id },
      },
    },
    select: {
      name: true,
    },
  })
  
  const uniqueExercises = new Set(allExercises.map(e => e.name)).size

  return (
    <DashboardClient 
      workouts={JSON.parse(JSON.stringify(workouts))} 
      stats={{
        totalWorkouts,
        recentWorkouts,
        uniqueExercises,
      }}
    />
  )
}

