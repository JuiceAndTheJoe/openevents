import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'
import { finalizeAccountDeletionForUser } from '@/lib/accountDeletion'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      roles: Role[]
      emailVerified: Date | null
      mustChangePassword: boolean
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
    roles: Role[]
    emailVerified: Date | null
    mustChangePassword: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    image?: string | null
    roles: Role[]
    emailVerified: Date | null
    mustChangePassword: boolean
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours (reduced from 30 days for security)
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

        const user = await prisma.user.findFirst({
          where: {
            email: credentials.email.toLowerCase(),
            deletedAt: null,
          },
          include: {
            roles: true,
          },
        })

        if (!user || !user.passwordHash) {
          throw new Error('Invalid email or password')
        }

        if (!user.emailVerified) {
          throw new Error('Please verify your email before logging in.')
        }

        if (user.deletionScheduledFor && user.deletionScheduledFor <= new Date()) {
          await finalizeAccountDeletionForUser(user.id)
          throw new Error('Account has been deleted')
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
          mustChangePassword: user.mustChangePassword,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user?.id) {
        return false
      }

      const dbUser = await prisma.user.findFirst({
        where: {
          id: user.id,
          deletedAt: null,
        },
        select: {
          id: true,
          deletionScheduledFor: true,
        },
      })

      if (!dbUser) {
        return false
      }

      if (dbUser.deletionScheduledFor && dbUser.deletionScheduledFor <= new Date()) {
        await finalizeAccountDeletionForUser(dbUser.id)
        return false
      }

      return true
    },
    async jwt({ token, user, trigger, session }) {
      if (typeof token.mustChangePassword !== 'boolean') {
        token.mustChangePassword = false
      }

      if (user) {
        token.id = user.id
        token.image = user.image
        token.roles = user.roles
        token.emailVerified = user.emailVerified
        token.mustChangePassword = user.mustChangePassword
        token.name = user.name
        token.email = user.email
      }

      // Handle session updates
      if (trigger === 'update' && session) {
        // Re-fetch user data from database
        const dbUser = await prisma.user.findFirst({
          where: {
            id: token.id,
            deletedAt: null,
          },
          include: { roles: true },
        })

        if (!dbUser) {
          token.id = ''
          token.roles = []
          token.email = ''
          token.name = null
          token.image = null
          token.emailVerified = null
          token.mustChangePassword = false
          return token
        }

        if (dbUser.deletionScheduledFor && dbUser.deletionScheduledFor <= new Date()) {
          await finalizeAccountDeletionForUser(dbUser.id)
          token.id = ''
          token.roles = []
          token.email = ''
          token.name = null
          token.image = null
          token.emailVerified = null
          token.mustChangePassword = false
          return token
        }

        token.image = dbUser.image
        token.roles = dbUser.roles.map((r) => r.role)
        token.email = dbUser.email
        token.name = `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || null
        token.mustChangePassword = dbUser.mustChangePassword
      }

      return token
    },
    async session({ session, token }) {
      const tokenId = typeof token.id === 'string' ? token.id : ''
      if (!tokenId) {
        session.user.id = ''
        session.user.roles = []
        session.user.emailVerified = null
        session.user.mustChangePassword = false
        session.user.email = ''
        session.user.name = null
        session.user.image = null
        return session
      }

      const dbUser = await prisma.user.findFirst({
        where: {
          id: tokenId,
          deletedAt: null,
        },
        include: {
          roles: true,
        },
      })

      if (!dbUser) {
        session.user.id = ''
        session.user.roles = []
        session.user.emailVerified = null
        session.user.mustChangePassword = false
        session.user.email = ''
        session.user.name = null
        session.user.image = null
        return session
      }

      if (dbUser.deletionScheduledFor && dbUser.deletionScheduledFor <= new Date()) {
        await finalizeAccountDeletionForUser(dbUser.id)
        session.user.id = ''
        session.user.roles = []
        session.user.emailVerified = null
        session.user.mustChangePassword = false
        session.user.email = ''
        session.user.name = null
        session.user.image = null
        return session
      }

      session.user.id = dbUser.id
      session.user.roles = dbUser.roles.map((entry) => entry.role)
      session.user.emailVerified = dbUser.emailVerified
      session.user.mustChangePassword = dbUser.mustChangePassword
      session.user.email = dbUser.email
      session.user.name = `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || null
      session.user.image = dbUser.image ?? null

      return session
    },
  },
}
