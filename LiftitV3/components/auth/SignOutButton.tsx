'use client'

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => signOut({ callbackUrl: '/auth/signin' })}
      className="text-muted-foreground hover:text-destructive transition-colors"
    >
      <LogOut className="h-4 w-4 mr-2" />
      <span className="hidden sm:inline">Sign Out</span>
    </Button>
  )
}

