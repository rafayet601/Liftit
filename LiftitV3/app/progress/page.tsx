import { getServerSession } from 'next-auth'
import { authOptions } from '../api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import ProgressTracker from '@/components/ProgressTracker'

export default async function ProgressPage() {
  const session = await getServerSession(authOptions)
  
  if (!session || !session.user) {
    redirect('/auth/signin')
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight gradient-text mb-2">
            Progress Tracking
          </h1>
          <p className="text-muted-foreground text-lg">
            Monitor your strength gains and workout trends over time
          </p>
        </div>
        
        <ProgressTracker userId={session.user.id} />
      </div>
    </div>
  )
}

