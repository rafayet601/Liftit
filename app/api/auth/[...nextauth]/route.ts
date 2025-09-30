import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import prisma from '@/lib/prisma'
import GithubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import AppleProvider from 'next-auth/providers/apple'
import CredentialsProvider from 'next-auth/providers/credentials'
import NextAuth from 'next-auth/next'

const demoLoginEnabled =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === 'true' ||
  process.env.ENABLE_DEMO_LOGIN === 'true'

const getDemoCredentials = () => {
  if (!demoLoginEnabled) {
    return null
  }

  const username =
    process.env.DEMO_LOGIN_USERNAME ||
    (process.env.NODE_ENV === 'development' ? 'demo-user' : undefined)
  const password =
    process.env.DEMO_LOGIN_PASSWORD ||
    (process.env.NODE_ENV === 'development' ? 'password' : undefined)
  const email =
    process.env.DEMO_LOGIN_EMAIL ||
    (process.env.NODE_ENV === 'development' ? 'demo@example.com' : undefined)

  if (!username || !password || !email) {
    console.warn('Demo login requested but credentials are missing. Skipping demo provider.')
    return null
  }

  return { username, password, email }
}

// Get the NextAuth secret from environment variables or generate a warning
if (!process.env.NEXTAUTH_SECRET) {
  console.warn('No NEXTAUTH_SECRET environment variable set. This is insecure in production!');
}

// Get the NextAuth URL from environment variables
const nextAuthUrl = process.env.NEXTAUTH_URL || (process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000' 
  : undefined);

if (!nextAuthUrl && process.env.NODE_ENV === 'production') {
  console.warn('No NEXTAUTH_URL environment variable set in production!');
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt', // Use JWT for credential provider compatibility
    maxAge: 30 * 24 * 60 * 60, // 30 days session lifetime
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development', // Enable debug mode in development only
  adapter: PrismaAdapter(prisma),
  providers: [
    // Only include GitHub provider if credentials are provided
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GithubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),
    // Only include Google provider if credentials are provided
    ...(process.env.GOOGLE_ID && process.env.GOOGLE_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_ID,
            clientSecret: process.env.GOOGLE_SECRET,
          }),
        ]
      : []),
    // Only include Apple provider if credentials are provided
    ...(process.env.APPLE_ID && process.env.APPLE_SECRET
      ? [
          AppleProvider({
            clientId: process.env.APPLE_ID,
            clientSecret: process.env.APPLE_SECRET,
          }),
        ]
      : []),
    // Include a credentials provider only when demo logins are explicitly enabled
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
                console.warn('Demo login attempted without configured credentials.')
                return null
              }

              const { username, password, email } = demoCredentials

              if (!credentials?.username || !credentials?.password) {
                return null
              }

              if (credentials.username !== username || credentials.password !== password) {
                return null
              }

              const user = await prisma.user.findUnique({
                where: { email },
              })

              if (!user) {
                console.warn('Demo login failed because the demo user has not been seeded.')
                return null
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
    // JWT callback to add user ID to the token
    jwt: async ({ token, user }) => {
      if (process.env.NODE_ENV === 'development') {
        console.log("JWT callback called", { tokenUserId: token.id, userId: user?.id });
      }
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    // Session callback to add user ID to the session
    session: async ({ session, token }) => {
      if (process.env.NODE_ENV === 'development') {
        console.log("Session callback called", { hasToken: !!token, hasUser: !!session.user });
      }
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    redirect: async ({ url, baseUrl }) => {
      if (process.env.NODE_ENV === 'development') {
        console.log("Redirect callback called", { url, baseUrl });
      }
      // Allow relative URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allow callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  // Add security headers for production
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
  logger: {
    error(code, metadata) {
      console.error("NextAuth Error:", code, metadata);
    },
    warn(code) {
      console.warn("NextAuth Warning:", code);
    },
    debug(code, metadata) {
      if (process.env.NODE_ENV === 'development') {
        console.debug("NextAuth Debug:", code, metadata);
      }
    },
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST } 