import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import prisma from '@/lib/prisma'
import GithubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import AppleProvider from 'next-auth/providers/apple'
import CredentialsProvider from 'next-auth/providers/credentials'
import NextAuth from 'next-auth/next'

// Check if demo login is enabled (development and/or demo)
const demoLoginEnabled =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === 'true' ||
  process.env.NODE_ENV !== 'production'

const getDemoCredentials = () => {
  if (!demoLoginEnabled) {
    return null
  }

  const username = process.env.NEXT_PUBLIC_DEMO_LOGIN_USERNAME
  const password = process.env.NEXT_PUBLIC_DEMO_LOGIN_PASSWORD
  const email = 'demo@liftit.app'

  if (!username || !password) {
    console.warn('Demo login requested but credentials are missing.')
    return null
  }

  return { username, password, email }
}

// Validate required environment variables
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET environment variable is required!')
}

if (!process.env.NEXTAUTH_URL && process.env.NODE_ENV === 'production') {
  throw new Error('NEXTAUTH_URL environment variable is required in production!')
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
  adapter: PrismaAdapter(prisma),
  providers: [
    // OAuth providers - only included if credentials are provided
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GithubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),
    ...(process.env.GOOGLE_ID && process.env.GOOGLE_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_ID,
            clientSecret: process.env.GOOGLE_SECRET,
          }),
        ]
      : []),
    ...(process.env.APPLE_ID && process.env.APPLE_SECRET
      ? [
          AppleProvider({
            clientId: process.env.APPLE_ID,
            clientSecret: process.env.APPLE_SECRET,
          }),
        ]
      : []),
    // Credentials provider - only enabled in development with explicit flag
    ...(demoLoginEnabled
      ? [
          CredentialsProvider({
            id: 'credentials',
            name: 'Demo Login',
            credentials: {
              username: { label: 'Username', type: 'text' },
              password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
              const demoCredentials = getDemoCredentials()

              if (!demoCredentials) {
                return null
              }

              const { username, password, email } = demoCredentials

              if (!credentials?.username || !credentials?.password) {
                return null
              }

              if (
                credentials.username !== username ||
                credentials.password !== password
              ) {
                return null
              }

              // Find or create demo user
              let user = await prisma.user.findUnique({
                where: { email },
              })

              if (!user) {
                user = await prisma.user.create({
                  data: {
                    email,
                    name: 'Demo User',
                  },
                })
              }

              return {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
              }
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id
      }
      return token
    },
    session: async ({ session, token }) => {
      if (token && session.user) {
        session.user.id = token.id as string
      }
      return session
    },
    redirect: async ({ url, baseUrl }) => {
      // Allow relative URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`
      // Allow callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  useSecureCookies: process.env.NODE_ENV === 'production',
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }

