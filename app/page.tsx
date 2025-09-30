import { getServerSession } from 'next-auth/next'
import { authOptions } from './api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'

export default async function Home() {
  const session = await getServerSession(authOptions)
  
  if (!session || !session.user) {
    redirect('/auth/signin')
    return null
  }
  
  // For now, always redirect to get-started
  // In a production app, you might want to check if the user has completed onboarding
  redirect('/get-started')
  return null
} 