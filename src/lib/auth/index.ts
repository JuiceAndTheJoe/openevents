import { getServerSession } from 'next-auth'
import { authOptions } from './config'
import { Role } from '@prisma/client'
import { prisma } from '@/lib/db'
import { finalizeAccountDeletionForUser } from '@/lib/accountDeletion'

export { authOptions } from './config'
export * from './permissions'

export async function getSession() {
  return getServerSession(authOptions)
}

export async function getCurrentUser() {
  const session = await getSession()
  if (!session?.user?.id) {
    return null
  }

  const dbUser = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      image: true,
      emailVerified: true,
      mustChangePassword: true,
      deletionScheduledFor: true,
      roles: {
        select: {
          role: true,
        },
      },
    },
  })

  if (!dbUser) {
    return null
  }

  if (dbUser.deletionScheduledFor && dbUser.deletionScheduledFor <= new Date()) {
    await finalizeAccountDeletionForUser(dbUser.id)
    return null
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || null,
    image: dbUser.image,
    roles: dbUser.roles.map((entry) => entry.role),
    emailVerified: dbUser.emailVerified,
    mustChangePassword: dbUser.mustChangePassword,
  }
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireRole(roles: Role | Role[]) {
  const user = await requireAuth()
  const requiredRoles = Array.isArray(roles) ? roles : [roles]
  const effectiveRoles = requiredRoles.includes('ORGANIZER')
    ? [...new Set<Role>([...requiredRoles, 'SUPER_ADMIN'])]
    : requiredRoles

  const hasRole = user.roles.some((role) => effectiveRoles.includes(role))
  if (!hasRole) {
    throw new Error('Forbidden: Insufficient permissions')
  }

  return user
}

export function hasRole(userRoles: Role[], requiredRoles: Role | Role[]): boolean {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]
  return userRoles.some((role) => roles.includes(role))
}

export function isOrganizer(userRoles: Role[]): boolean {
  return hasRole(userRoles, 'ORGANIZER')
}

export function isSuperAdmin(userRoles: Role[]): boolean {
  return hasRole(userRoles, 'SUPER_ADMIN')
}
