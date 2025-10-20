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
  const [debug, setDebug] = useState<any>({})
  const demoLoginEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === 'true'
  const demoUsername = process.env.NEXT_PUBLIC_DEMO_LOGIN_USERNAME || ''
  const demoPassword = process.env.NEXT_PUBLIC_DEMO_LOGIN_PASSWORD || ''
  
  useEffect(() => {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    setDebug(params);
    
    if (error) {
      console.error("Auth error from URL:", error);
    }
  }, [searchParams, error]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setAuthError('')

    try {
      if (!demoLoginEnabled) {
        setAuthError('Email/password login is disabled. Please sign in with an OAuth provider.')
        return
      }

      const loginUsername = username.trim()
      const loginPassword = password.trim()

      console.log(`Attempting to sign in with credentials for ${loginUsername}`)
      const result = await signIn('credentials', {
        username: loginUsername,
        password: loginPassword,
        redirect: false,
        callbackUrl: callbackUrl
      })
      console.log("Sign-in result:", result);
      if (result?.error) {
        setAuthError(result.error)
        console.error("Sign-in error:", result.error);
      } else if (result?.ok) {
        console.log("Sign-in successful, redirecting to:", callbackUrl);
        window.location.href = callbackUrl;
      } else {
        setAuthError("An unknown error occurred during sign in.");
      }
    } catch (err) {
      console.error('Sign in error:', err)
      setAuthError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleDemoLogin = (e: React.MouseEvent) => {
    e.preventDefault();

    setIsLoading(true);
    if (!demoLoginEnabled || !demoUsername || !demoPassword) {
      console.warn('Demo login requested but demo credentials are not configured.')
      setIsLoading(false)
      return
    }

    try {
      console.log('Performing direct demo login');
      signIn('credentials', {
        username: demoUsername,
        password: demoPassword,
        callbackUrl: callbackUrl,
        redirect: true
      });
    } catch (err) {
      console.error('Demo login failed:', err);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md px-4"
      >
        <Card className="border-glow bg-card/60 backdrop-blur-sm shadow-xl">
          <CardHeader className="space-y-1 text-center pb-6">
            <motion.div 
              className="flex items-center justify-center mb-6"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, type: "spring" }}
            >
              <div className="bg-primary/20 p-4 rounded-full">
                <Dumbbell className="h-10 w-10 text-primary" />
              </div>
            </motion.div>
            <CardTitle className="text-3xl font-bold gradient-text">Liftit</CardTitle>
            <CardDescription className="text-muted-foreground pt-1">
              Access your personalized workout experience
            </CardDescription>
          </CardHeader>
          
          {authError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mx-6 mb-6 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground"
            >
              <AlertCircle className="h-4 w-4" />
              <p>{authError === 'CredentialsSignin' ? 'Invalid username or password.' : authError}</p>
            </motion.div>
          )}
          
          <CardContent className="space-y-6 pt-2">
            {/* Demo Login Button */}
            {demoLoginEnabled && (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
                  onClick={handleDemoLogin}
                  disabled={isLoading || !demoUsername || !demoPassword}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Dumbbell className="mr-2 h-4 w-4" />
                  )}
                  Sign in as Demo User
                </Button>
              </motion.div>
            )}

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or use credentials</span>
              </div>
            </div>

            {/* Manual Login Form */}
            {demoLoginEnabled && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <motion.div
                  className="space-y-2"
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <label htmlFor="username" className="text-sm font-medium text-muted-foreground">Username</label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={demoLoginEnabled && demoUsername ? demoUsername : 'your username'}
                    type="text"
                    autoComplete="username"
                    className="bg-background/50 border-border/40 focus:border-primary/50 transition-all duration-300"
                    required
                  />
                </motion.div>
                <motion.div
                  className="space-y-2"
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <label htmlFor="password" className="text-sm font-medium text-muted-foreground">Password</label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    autoComplete="current-password"
                    className="bg-background/50 border-border/40 focus:border-primary/50 transition-all duration-300"
                    required
                  />
                </motion.div>
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
                    className="w-full shadow-md shadow-primary/20 transition-all duration-300"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Sign In
                  </Button>
                </motion.div>
              </form>
            )}
            {!demoLoginEnabled && (
              <p className="text-sm text-muted-foreground text-center">
                Email/password login is disabled. Enable demo credentials or use an OAuth provider to continue.
              </p>
            )}
            
            {/* Debug Info (Optional) */}
            {process.env.NODE_ENV === 'development' && Object.keys(debug).length > 0 && (
              <details className="mt-6 bg-background/30 p-3 rounded-md text-xs">
                <summary className="text-xs text-muted-foreground cursor-pointer">Debug Info</summary>
                <pre className="mt-2 text-xs text-muted-foreground/70 overflow-auto">
                  {JSON.stringify(debug, null, 2)}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
} 