import React from 'react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { getServerSession } from 'next-auth'
import { authOptions } from './api/auth/[...nextauth]/route'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Dumbbell, Menu, X } from 'lucide-react'
import { Providers } from './providers'
import { SignOutButton } from '@/components/auth/SignOutButton'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Liftit V3 | Modern Fitness Tracking',
  description: 'Track your workouts, monitor your progress, and achieve your fitness goals with Liftit V3 - the modern fitness tracking app.',
  keywords: ['fitness', 'workout', 'tracking', 'gym', 'exercise', 'progress'],
  authors: [{ name: 'Liftit Team' }],
  openGraph: {
    title: 'Liftit V3 | Modern Fitness Tracking',
    description: 'Track your workouts, monitor your progress, and achieve your fitness goals.',
    type: 'website',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gradient-modern antialiased min-h-screen flex flex-col`}>
        <Providers session={session}>
          <header className="sticky top-0 z-50 w-full border-b border-border/40 glass-effect backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 animate-fadeIn">
            <div className="container flex h-16 items-center justify-between px-4 md:px-6">
              <Link href={session ? "/get-started" : "/"} className="flex items-center gap-2 gradient-text font-semibold text-lg group">
                <div className="bg-primary/10 p-2 rounded-xl group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110">
                  <Dumbbell className="h-5 w-5 text-primary" />
                </div>
                <span className="font-bold text-xl">Liftit <span className="text-xs text-muted-foreground">V3</span></span>
              </Link>
              
              <nav className="flex items-center gap-2 md:gap-4 text-sm">
                {session ? (
                  <>
                    <Link 
                      href="/get-started"
                      className="hidden sm:block transition-all duration-300 hover:text-primary text-foreground/70 hover:translate-y-[-1px] font-medium"
                    >
                      Home
                    </Link>
                    <Link 
                      href="/dashboard"
                      className="transition-all duration-300 hover:text-primary text-foreground/70 hover:translate-y-[-1px] font-medium"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/progress"
                      className="hidden sm:block transition-all duration-300 hover:text-primary text-foreground/70 hover:translate-y-[-1px] font-medium"
                    >
                      Progress
                    </Link>
                    <SignOutButton />
                  </>
                ) : (
                  <Button variant="default" size="sm" asChild className="btn-glow">
                    <Link href="/auth/signin">Sign In</Link>
                  </Button>
                )}
              </nav>
            </div>
          </header>
          
          <main className="flex-1 container py-6 md:py-8 px-4 md:px-6 page-enter relative z-10">
            {children}
          </main>
          
          <footer className="py-6 md:py-8 border-t border-border/40 glass-effect backdrop-blur-sm mt-auto">
            <div className="container flex flex-col items-center justify-between gap-4 md:flex-row px-4 md:px-6">
              <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
                Built with ❤️ for fitness enthusiasts. © {new Date().getFullYear()} Liftit V3
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {session && (
                  <>
                    <Link href="/exercises" className="hover:text-primary transition-colors">
                      Exercises
                    </Link>
                    <Link href="/about" className="hover:text-primary transition-colors">
                      About
                    </Link>
                  </>
                )}
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  )
}

