import { getServerSession } from 'next-auth'
import { authOptions } from '../api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import WorkoutsClient from './workouts-client'

export default async function WorkoutsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session || !session.user) {
    redirect('/auth/signin')
  }

  // Fetch all workouts for the user
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

  return <WorkoutsClient workouts={JSON.parse(JSON.stringify(workouts))} />
}

