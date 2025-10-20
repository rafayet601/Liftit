import { getServerSession } from 'next-auth'
import { authOptions } from '../api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import ExerciseLibraryClient from './exercise-library-client'

export default async function ExercisesPage() {
  const session = await getServerSession(authOptions)
  
  if (!session || !session.user) {
    redirect('/auth/signin')
  }

  return <ExerciseLibraryClient />
}

