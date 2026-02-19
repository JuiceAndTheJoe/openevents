import { getServerSession } from 'next-auth'
import { authOptions } from './config'
import { Role } from '@prisma/client'

export { authOptions } from './config'
export * from './permissions'

export async function getSession() {
  return getServerSession(authOptions)
}

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user
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

  const hasRole = user.roles.some((role) => requiredRoles.includes(role))
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

export function isAttendee(userRoles: Role[]): boolean {
  return hasRole(userRoles, 'ATTENDEE')
}
