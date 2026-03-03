import { Role } from '@prisma/client'
import { hasRole } from '@/lib/auth'

type OrderAccessInput = {
  orderUserId: string | null
  organizerUserId: string
  requesterUserId: string
  requesterRoles: Role[]
  // For anonymous orders, allow access if PayPal token matches
  isAnonymousOrderWithValidToken?: boolean
}

type OrderAccessFlags = {
  isOwner: boolean
  isOrganizer: boolean
  isSuperAdmin: boolean
  isAnonymousWithValidToken: boolean
}

export function getOrderAccessFlags(input: OrderAccessInput): OrderAccessFlags {
  const isOwner = input.orderUserId !== null && input.orderUserId === input.requesterUserId
  const isOrganizer = input.organizerUserId === input.requesterUserId
  const isSuperAdmin = hasRole(input.requesterRoles, 'SUPER_ADMIN')
  const isAnonymousWithValidToken = input.isAnonymousOrderWithValidToken ?? false

  return {
    isOwner,
    isOrganizer,
    isSuperAdmin,
    isAnonymousWithValidToken,
  }
}

export function canAccessOrder(input: OrderAccessInput): boolean {
  const access = getOrderAccessFlags(input)
  return access.isOwner || access.isOrganizer || access.isSuperAdmin || access.isAnonymousWithValidToken
}

export function canManageRefund(input: OrderAccessInput): boolean {
  const access = getOrderAccessFlags(input)
  return access.isOrganizer || access.isSuperAdmin
}
