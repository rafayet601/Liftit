import { getServerSession } from 'next-auth'
import { authOptions } from '../api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import GetStartedClient from './get-started-client'

export default async function GetStartedPage() {
  const session = await getServerSession(authOptions)
  
  if (!session || !session.user) {
    redirect('/auth/signin')
  }

  return <GetStartedClient />
}

