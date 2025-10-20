'use client'

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

interface SignOutButtonProps {
  className?: string
}

export function SignOutButton({ className }: SignOutButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={`border-glow ${className ?? ''}`.trim()}
      onClick={() => signOut()}
    >
      Sign Out
    </Button>
  )
}
