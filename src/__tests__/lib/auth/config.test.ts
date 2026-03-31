/**
 * Tests for auth callback functions in src/lib/auth/config.ts
 *
 * These callbacks handle critical security logic including:
 * - Credential validation
 * - Email verification checks
 * - Soft-deleted account handling
 * - Token population and refresh
 * - Session validation
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { Role } from '@prisma/client'

// Mock dependencies before importing authOptions
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}))

vi.mock('@/lib/accountDeletion', () => ({
  finalizeAccountDeletionForUser: vi.fn(),
}))

vi.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: vi.fn(() => ({})),
}))

// Import after mocks are set up
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { finalizeAccountDeletionForUser } from '@/lib/accountDeletion'

// Helper to create mock user data
function createMockUser(overrides: Partial<{
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  image: string | null
  passwordHash: string | null
  emailVerified: Date | null
  deletedAt: Date | null
  deletionScheduledFor: Date | null
  mustChangePassword: boolean
  roles: Array<{ role: Role }>
}> = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    image: null,
    passwordHash: 'hashed-password',
    emailVerified: new Date('2024-01-01'),
    deletedAt: null,
    deletionScheduledFor: null,
    mustChangePassword: false,
    roles: [] as Array<{ role: Role }>,
    ...overrides,
  }
}

// Helper to create empty session
function createEmptySession() {
  return {
    user: {
      id: '',
      email: '',
      name: null,
      image: null,
      roles: [] as Role[],
      emailVerified: null,
      mustChangePassword: false,
    },
    expires: new Date().toISOString(),
  }
}

// Get the authorize function from the credentials provider
function getAuthorizeFunction() {
  const credentialsProvider = authOptions.providers.find(
    (p) => p.type === 'credentials'
  )
  if (!credentialsProvider || !('authorize' in credentialsProvider.options)) {
    throw new Error('Credentials provider not found')
  }
  return credentialsProvider.options.authorize as (
    credentials: { email?: string; password?: string } | undefined
  ) => Promise<{
    id: string
    email: string
    name: string | null
    image: string | null
    roles: Role[]
    emailVerified: Date | null
  } | null>
}

describe('Auth Config Callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authorize', () => {
    const authorize = getAuthorizeFunction()

    it('returns user when credentials are valid', async () => {
      const mockUser = createMockUser()
      ;(prisma.user.findFirst as Mock).mockResolvedValue(mockUser)
      ;(bcrypt.compare as Mock).mockResolvedValue(true)

      const result = await authorize({
        email: 'test@example.com',
        password: 'valid-password',
      })

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        roles: [],
        emailVerified: mockUser.emailVerified,
        mustChangePassword: false,
      })
    })

    it('throws error when email is missing', async () => {
      await expect(
        authorize({ password: 'password' })
      ).rejects.toThrow('Email and password required')
    })

    it('throws error when password is missing', async () => {
      await expect(
        authorize({ email: 'test@example.com' })
      ).rejects.toThrow('Email and password required')
    })

    it('throws error when credentials are undefined', async () => {
      await expect(authorize(undefined)).rejects.toThrow(
        'Email and password required'
      )
    })

    it('throws error when user not found', async () => {
      ;(prisma.user.findFirst as Mock).mockResolvedValue(null)

      await expect(
        authorize({ email: 'nonexistent@example.com', password: 'password' })
      ).rejects.toThrow('Invalid email or password')
    })

    it('throws error when user has no password (OAuth-only account)', async () => {
      const mockUser = createMockUser({ passwordHash: null })
      ;(prisma.user.findFirst as Mock).mockResolvedValue(mockUser)

      await expect(
        authorize({ email: 'test@example.com', password: 'password' })
      ).rejects.toThrow('Invalid email or password')
    })

    it('throws error when email not verified', async () => {
      const mockUser = createMockUser({ emailVerified: null })
      ;(prisma.user.findFirst as Mock).mockResolvedValue(mockUser)

      await expect(
        authorize({ email: 'test@example.com', password: 'password' })
      ).rejects.toThrow('Please verify your email before logging in')
    })

    it('throws error when password is invalid', async () => {
      const mockUser = createMockUser()
      ;(prisma.user.findFirst as Mock).mockResolvedValue(mockUser)
      ;(bcrypt.compare as Mock).mockResolvedValue(false)

      await expect(
        authorize({ email: 'test@example.com', password: 'wrong-password' })
      ).rejects.toThrow('Invalid email or password')
    })

    it('calls finalizeAccountDeletionForUser and throws when deletion is due', async () => {
      const pastDate = new Date(Date.now() - 86400000) // Yesterday
      const mockUser = createMockUser({ deletionScheduledFor: pastDate })
      ;(prisma.user.findFirst as Mock).mockResolvedValue(mockUser)
      ;(finalizeAccountDeletionForUser as Mock).mockResolvedValue({
        finalized: true,
      })

      await expect(
        authorize({ email: 'test@example.com', password: 'password' })
      ).rejects.toThrow('Account has been deleted')

      expect(finalizeAccountDeletionForUser).toHaveBeenCalledWith('user-123')
    })

    it('returns user with combined first and last name', async () => {
      const mockUser = createMockUser({
        firstName: 'John',
        lastName: 'Doe',
      })
      ;(prisma.user.findFirst as Mock).mockResolvedValue(mockUser)
      ;(bcrypt.compare as Mock).mockResolvedValue(true)

      const result = await authorize({
        email: 'test@example.com',
        password: 'valid-password',
      })

      expect(result?.name).toBe('John Doe')
    })

    it('returns null name when both first and last name are empty', async () => {
      const mockUser = createMockUser({
        firstName: null,
        lastName: null,
      })
      ;(prisma.user.findFirst as Mock).mockResolvedValue(mockUser)
      ;(bcrypt.compare as Mock).mockResolvedValue(true)

      const result = await authorize({
        email: 'test@example.com',
        password: 'valid-password',
      })

      expect(result?.name).toBe(null)
    })
  })

  describe('signIn', () => {
    const signIn = authOptions.callbacks!.signIn!

    it('returns true for valid active user', async () => {
      const mockUser = { id: 'user-123', deletionScheduledFor: null }
      ;(prisma.user.findFirst as Mock).mockResolvedValue(mockUser)

      const result = await signIn({
        user: { id: 'user-123', email: 'test@example.com', emailVerified: null, roles: [], mustChangePassword: false },
        account: null,
        profile: undefined,
      })

      expect(result).toBe(true)
    })

    it('returns false when user.id is missing', async () => {
      const result = await signIn({
        user: { id: '', email: 'test@example.com', emailVerified: null, roles: [], mustChangePassword: false },
        account: null,
        profile: undefined,
      })

      expect(result).toBe(false)
      expect(prisma.user.findFirst).not.toHaveBeenCalled()
    })

    it('returns false when user is undefined', async () => {
      const result = await signIn({
        user: undefined as any,
        account: null,
        profile: undefined,
      })

      expect(result).toBe(false)
    })

    it('returns false when user not found in database', async () => {
      ;(prisma.user.findFirst as Mock).mockResolvedValue(null)

      const result = await signIn({
        user: { id: 'nonexistent-user', email: 'test@example.com', emailVerified: null, roles: [], mustChangePassword: false },
        account: null,
        profile: undefined,
      })

      expect(result).toBe(false)
    })

    it('calls finalizeAccountDeletionForUser and returns false when deletion is due', async () => {
      const pastDate = new Date(Date.now() - 86400000) // Yesterday
      const mockUser = { id: 'user-123', deletionScheduledFor: pastDate }
      ;(prisma.user.findFirst as Mock).mockResolvedValue(mockUser)
      ;(finalizeAccountDeletionForUser as Mock).mockResolvedValue({
        finalized: true,
      })

      const result = await signIn({
        user: { id: 'user-123', email: 'test@example.com', emailVerified: null, roles: [], mustChangePassword: false },
        account: null,
        profile: undefined,
      })

      expect(result).toBe(false)
      expect(finalizeAccountDeletionForUser).toHaveBeenCalledWith('user-123')
    })

    it('returns true when deletion is scheduled but not yet due', async () => {
      const futureDate = new Date(Date.now() + 86400000) // Tomorrow
      const mockUser = { id: 'user-123', deletionScheduledFor: futureDate }
      ;(prisma.user.findFirst as Mock).mockResolvedValue(mockUser)

      const result = await signIn({
        user: { id: 'user-123', email: 'test@example.com', emailVerified: null, roles: [], mustChangePassword: false },
        account: null,
        profile: undefined,
      })

      expect(result).toBe(true)
      expect(finalizeAccountDeletionForUser).not.toHaveBeenCalled()
    })
  })

  describe('jwt', () => {
    const jwt = authOptions.callbacks!.jwt!

    it('populates token from user on initial sign-in', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.jpg',
        roles: ['ORGANIZER' as Role],
        emailVerified: new Date('2024-01-01'),
        mustChangePassword: false,
      }

      const token = { sub: 'user-123', id: '', roles: [] as Role[], emailVerified: null, mustChangePassword: false }

      const result = await jwt({ token, user, account: null })

      expect(result).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.jpg',
        roles: ['ORGANIZER'],
        emailVerified: user.emailVerified,
      })
    })

    it('returns existing token when no user provided', async () => {
      const token = {
        sub: 'user-123',
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        roles: ['ORGANIZER' as Role],
        emailVerified: new Date('2024-01-01'),
        mustChangePassword: false,
      }

      const result = await jwt({ token, user: undefined as any, account: null })

      expect(result).toEqual(token)
    })

    it('refreshes user data from DB on trigger: update', async () => {
      const mockDbUser = createMockUser({
        firstName: 'Updated',
        lastName: 'Name',
        image: 'new-image.jpg',
        roles: [{ role: 'ORGANIZER' as Role }],
      })
      ;(prisma.user.findFirst as Mock).mockResolvedValue(mockDbUser)

      const token = {
        sub: 'user-123',
        id: 'user-123',
        email: 'old@example.com',
        name: 'Old Name',
        image: 'old-image.jpg',
        roles: ['ORGANIZER' as Role],
        emailVerified: new Date('2024-01-01'),
        mustChangePassword: false,
      }

      const result = await jwt({
        token,
        user: undefined as any,
        account: null,
        trigger: 'update',
        session: {},
      })

      expect(result).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Updated Name',
        image: 'new-image.jpg',
        roles: ['ORGANIZER'],
      })
    })

    it('clears token fields when user is deleted during session update', async () => {
      ;(prisma.user.findFirst as Mock).mockResolvedValue(null)

      const token = {
        sub: 'user-123',
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: 'avatar.jpg',
        roles: ['ORGANIZER' as Role],
        emailVerified: new Date('2024-01-01'),
        mustChangePassword: false,
      }

      const result = await jwt({
        token,
        user: undefined as any,
        account: null,
        trigger: 'update',
        session: {},
      })

      expect(result).toMatchObject({
        id: '',
        email: '',
        name: null,
        image: null,
        roles: [],
        emailVerified: null,
      })
    })

    it('calls finalizeAccountDeletionForUser on session update if deletion is due', async () => {
      const pastDate = new Date(Date.now() - 86400000) // Yesterday
      const mockDbUser = createMockUser({ deletionScheduledFor: pastDate })
      ;(prisma.user.findFirst as Mock).mockResolvedValue(mockDbUser)
      ;(finalizeAccountDeletionForUser as Mock).mockResolvedValue({
        finalized: true,
      })

      const token = {
        sub: 'user-123',
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        roles: ['ORGANIZER' as Role],
        emailVerified: new Date('2024-01-01'),
        mustChangePassword: false,
      }

      const result = await jwt({
        token,
        user: undefined as any,
        account: null,
        trigger: 'update',
        session: {},
      })

      expect(finalizeAccountDeletionForUser).toHaveBeenCalledWith('user-123')
      expect(result).toMatchObject({
        id: '',
        email: '',
        name: null,
        image: null,
        roles: [],
        emailVerified: null,
      })
    })
  })

  describe('session', () => {
    const session = authOptions.callbacks!.session!

    it('returns empty session when token.id is empty', async () => {
      const mockSession = createEmptySession()
      const token = {
        id: '',
        email: 'test@example.com',
        roles: ['ORGANIZER' as Role],
        emailVerified: null,
        mustChangePassword: false,
      }

      const result = await session({
        session: mockSession,
        token,
        user: mockSession.user,
        trigger: 'update',
        newSession: undefined,
      }) as any

      expect(result.user.id).toBe('')
      expect(result.user.roles).toEqual([])
      expect(result.user.email).toBe('')
      expect(result.user.name).toBe(null)
      expect(prisma.user.findFirst).not.toHaveBeenCalled()
    })

    it('returns empty session when user not found in DB', async () => {
      ;(prisma.user.findFirst as Mock).mockResolvedValue(null)

      const mockSession = createEmptySession()
      const token = {
        id: 'user-123',
        email: 'test@example.com',
        roles: ['ORGANIZER' as Role],
        emailVerified: null,
        mustChangePassword: false,
      }

      const result = await session({
        session: mockSession,
        token,
        user: mockSession.user,
        trigger: 'update',
        newSession: undefined,
      }) as any

      expect(result.user.id).toBe('')
      expect(result.user.roles).toEqual([])
      expect(result.user.emailVerified).toBe(null)
    })

    it('returns empty session when user is soft-deleted', async () => {
      // The findFirst query filters by deletedAt: null, so a soft-deleted user
      // would return null from the query
      ;(prisma.user.findFirst as Mock).mockResolvedValue(null)

      const mockSession = createEmptySession()
      const token = {
        id: 'deleted-user-123',
        email: 'deleted@example.com',
        roles: ['ORGANIZER' as Role],
        emailVerified: null,
        mustChangePassword: false,
      }

      const result = await session({
        session: mockSession,
        token,
        user: mockSession.user,
        trigger: 'update',
        newSession: undefined,
      }) as any

      expect(result.user.id).toBe('')
      expect(result.user.roles).toEqual([])
    })

    it('calls finalizeAccountDeletionForUser when deletion is due', async () => {
      const pastDate = new Date(Date.now() - 86400000) // Yesterday
      const mockDbUser = createMockUser({ deletionScheduledFor: pastDate })
      ;(prisma.user.findFirst as Mock).mockResolvedValue(mockDbUser)
      ;(finalizeAccountDeletionForUser as Mock).mockResolvedValue({
        finalized: true,
      })

      const mockSession = createEmptySession()
      const token = {
        id: 'user-123',
        email: 'test@example.com',
        roles: ['ORGANIZER' as Role],
        emailVerified: null,
        mustChangePassword: false,
      }

      const result = await session({
        session: mockSession,
        token,
        user: mockSession.user,
        trigger: 'update',
        newSession: undefined,
      }) as any

      expect(finalizeAccountDeletionForUser).toHaveBeenCalledWith('user-123')
      expect(result.user.id).toBe('')
      expect(result.user.roles).toEqual([])
    })

    it('populates session correctly for valid active user', async () => {
      const mockDbUser = createMockUser({
        firstName: 'John',
        lastName: 'Doe',
        image: 'https://example.com/avatar.jpg',
        roles: [{ role: 'ORGANIZER' as Role }],
        emailVerified: new Date('2024-01-01'),
      })
      ;(prisma.user.findFirst as Mock).mockResolvedValue(mockDbUser)

      const mockSession = createEmptySession()
      const token = {
        id: 'user-123',
        email: 'test@example.com',
        roles: ['ORGANIZER' as Role],
        emailVerified: null,
        mustChangePassword: false,
      }

      const result = await session({
        session: mockSession,
        token,
        user: mockSession.user,
        trigger: 'update',
        newSession: undefined,
      }) as any

      expect(result.user.id).toBe('user-123')
      expect(result.user.email).toBe('test@example.com')
      expect(result.user.name).toBe('John Doe')
      expect(result.user.image).toBe('https://example.com/avatar.jpg')
      expect(result.user.roles).toEqual(['ORGANIZER'])
      expect(result.user.emailVerified).toEqual(new Date('2024-01-01'))
    })

    it('handles null image from database', async () => {
      const mockDbUser = createMockUser({ image: null })
      ;(prisma.user.findFirst as Mock).mockResolvedValue(mockDbUser)

      const mockSession = createEmptySession()
      const token = {
        id: 'user-123',
        email: 'test@example.com',
        roles: ['ORGANIZER' as Role],
        emailVerified: null,
        mustChangePassword: false,
      }

      const result = await session({
        session: mockSession,
        token,
        user: mockSession.user,
        trigger: 'update',
        newSession: undefined,
      }) as any

      expect(result.user.image).toBe(null)
    })
  })

})
