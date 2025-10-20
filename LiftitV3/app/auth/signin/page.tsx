'use client'

import React, { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dumbbell, Github, Mail, AlertCircle, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

export default function SignIn() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/get-started'
  const error = searchParams.get('error')
  
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [authError, setAuthError] = useState(error || '')
  
  const demoLoginEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === 'true'
  const demoUsername = process.env.NEXT_PUBLIC_DEMO_LOGIN_USERNAME || ''
  const demoPassword = process.env.NEXT_PUBLIC_DEMO_LOGIN_PASSWORD || ''
  
  useEffect(() => {
    if (error) {
      setAuthError(error === 'CredentialsSignin' ? 'Invalid username or password.' : error)
    }
  }, [error])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setAuthError('')

    try {
      if (!demoLoginEnabled) {
        // In dev, credentials login is allowed even if demo is disabled to simplify testing
      }

      const result = await signIn('credentials', {
        username: username.trim(),
        password: password.trim(),
        redirect: false,
        callbackUrl: callbackUrl
      })
      
      if (result?.error) {
        setAuthError(result.error === 'CredentialsSignin' ? 'Invalid username or password.' : result.error)
      } else if (result?.ok) {
        router.push(callbackUrl)
      }
    } catch (err) {
      setAuthError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleDemoLogin = async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    if (!demoLoginEnabled || !demoUsername || !demoPassword) {
      setAuthError('Demo login is not available.')
      setIsLoading(false)
      return
    }

    try {
      const result = await signIn('credentials', {
        username: demoUsername,
        password: demoPassword,
        redirect: false,
        callbackUrl: callbackUrl
      })
      
      if (result?.error) {
        setAuthError('Demo login failed. Please check your configuration.')
      } else if (result?.ok) {
        router.push(callbackUrl)
      }
    } catch (err) {
      setAuthError('Demo login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthLogin = (provider: string) => {
    signIn(provider, { callbackUrl })
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md px-4"
      >
        <Card className="card-modern border-glow shadow-2xl">
          <CardHeader className="space-y-1 text-center pb-6">
            <motion.div 
              className="flex items-center justify-center mb-6"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
            >
              <div className="bg-gradient-to-br from-primary/20 to-accent/10 p-5 rounded-2xl">
                <Dumbbell className="h-12 w-12 text-primary" />
              </div>
            </motion.div>
            <CardTitle className="text-3xl font-bold gradient-text">Welcome to Liftit</CardTitle>
            <CardDescription className="text-muted-foreground pt-2 text-base">
              Sign in to track your fitness journey
            </CardDescription>
          </CardHeader>
          
          {authError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mx-6 mb-6 flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm"
            >
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              <p className="text-destructive-foreground">{authError}</p>
            </motion.div>
          )}
          
          <CardContent className="space-y-6 pt-2">
            {/* Demo Login Button */}
            {demoLoginEnabled && demoUsername && demoPassword && (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  className="w-full h-12 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg shadow-primary/20 font-medium"
                  onClick={handleDemoLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Dumbbell className="mr-2 h-5 w-5" />
                  )}
                  Try Demo Account
                </Button>
              </motion.div>
            )}

            {/* Divider */}
            {demoLoginEnabled && (
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/60" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-muted-foreground font-medium">Or continue with</span>
                </div>
              </div>
            )}

            {/* OAuth Providers */}
            <div className="space-y-3">
              {process.env.NEXT_PUBLIC_GITHUB_ENABLED === 'true' && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    className="w-full h-11 border-border/50 hover:border-primary/50 hover:bg-primary/5"
                    onClick={() => handleOAuthLogin('github')}
                    disabled={isLoading}
                  >
                    <Github className="mr-2 h-5 w-5" />
                    Sign in with GitHub
                  </Button>
                </motion.div>
              )}
              
              {process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true' && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    className="w-full h-11 border-border/50 hover:border-primary/50 hover:bg-primary/5"
                    onClick={() => handleOAuthLogin('google')}
                    disabled={isLoading}
                  >
                    <Mail className="mr-2 h-5 w-5" />
                    Sign in with Google
                  </Button>
                </motion.div>
              )}
            </div>

            {/* Manual Login Form */}
            {demoLoginEnabled && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/60" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-3 text-muted-foreground font-medium">Or use credentials</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="username" className="text-sm font-medium text-foreground/90">
                      Username
                    </label>
                    <Input
                      id="username"
                      name="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      type="text"
                      autoComplete="username"
                      className="h-11 bg-background border-border/60 focus:border-primary focus:bg-background/80 transition-colors"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium text-foreground/90">
                      Password
                    </label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="h-11 bg-background border-border/60 focus:border-primary focus:bg-background/80 transition-colors"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="pt-2"
                  >
                    <Button
                      type="submit"
                      className="w-full h-11 bg-primary/90 hover:bg-primary shadow-md shadow-primary/20"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        'Sign In'
                      )}
                    </Button>
                  </motion.div>
                </form>
              </>
            )}
            
            {!demoLoginEnabled && !process.env.NEXT_PUBLIC_GITHUB_ENABLED && !process.env.NEXT_PUBLIC_GOOGLE_ENABLED && (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">
                  No authentication methods are currently available.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Please contact the administrator.
                </p>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-2 text-center text-xs text-muted-foreground border-t border-border/30 pt-6">
            <p>
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  )
}

