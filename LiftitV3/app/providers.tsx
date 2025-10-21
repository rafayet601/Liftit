'use client'

import { SessionProvider } from 'next-auth/react'
import { Session } from 'next-auth'
import { UnitProvider } from '@/contexts/UnitContext'

export function Providers({ 
  children, 
  session 
}: { 
  children: React.ReactNode
  session?: Session | null
}) {
  return (
    <SessionProvider session={session}>
      <UnitProvider>
        {children}
      </UnitProvider>
    </SessionProvider>
  )
}

