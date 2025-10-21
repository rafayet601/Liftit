import { getServerSession } from 'next-auth'
import { authOptions } from '../api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import RecommendationsClient from './recommendations-client'

export default async function RecommendationsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session || !session.user) {
    redirect('/auth/signin')
  }

  return <RecommendationsClient />
}

