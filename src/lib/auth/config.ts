import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      roles: Role[]
      emailVerified: Date | null
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
    roles: Role[]
    emailVerified: Date | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    roles: Role[]
    emailVerified: Date | null
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
    verifyRequest: '/verify-email',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            roles: true,
          },
        })

        if (!user || !user.passwordHash) {
          throw new Error('Invalid email or password')
        }

        if (!user.emailVerified) {
          throw new Error('Please verify your email before logging in')
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isPasswordValid) {
          throw new Error('Invalid email or password')
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
          image: user.image,
          roles: user.roles.map((r) => r.role),
          emailVerified: user.emailVerified,
        }
      },
    }),
  ],
  callbacks: {
    async signIn() {
      return true
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.roles = user.roles
        token.emailVerified = user.emailVerified
        token.name = user.name
        token.email = user.email
        token.picture = user.image || null
      }

      // Handle session updates
      if (trigger === 'update' && session) {
        // Re-fetch user data from database
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          include: { roles: true },
        })
        if (dbUser) {
          token.roles = dbUser.roles.map((r) => r.role)
          token.email = dbUser.email
          token.name = `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || null
          token.picture = dbUser.image || null
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.roles = token.roles
        session.user.emailVerified = token.emailVerified
        session.user.email = token.email as string
        session.user.name = (token.name as string | null) || null
        session.user.image = (token.picture as string | null) || null
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      // Assign ATTENDEE role to new users
      await prisma.userRole.create({
        data: {
          userId: user.id,
          role: 'ATTENDEE',
        },
      })
    },
  },
}
