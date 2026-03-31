import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { Prisma } from '@prisma/client'

// GET: List users with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    await requireRole('SUPER_ADMIN')

    const searchParams = request.nextUrl.searchParams
    const role = searchParams.get('role')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)

    const skip = (page - 1) * pageSize

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    }

    // Filter by role
    if (role === 'ORGANIZER') {
      where.roles = {
        some: {
          role: 'ORGANIZER',
        },
      }
    }

    // Search by email or name
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          roles: {
            select: {
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      data: users.map((user) => ({
        ...user,
        roles: user.roles.map((r) => r.role),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Please sign in to continue.' },
          { status: 401 }
        )
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'You do not have permission.' },
          { status: 403 }
        )
      }
    }

    console.error('List users error:', error)
    return NextResponse.json(
      { error: 'Request failed', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}

const createAdminUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  accountType: z.enum(['ORGANIZER', 'SUPER_ADMIN']).default('ORGANIZER'),
})

function generateOneTimePassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%&*'
  const all = `${upper}${lower}${digits}${symbols}`

  const pick = (charset: string) => charset[crypto.randomInt(0, charset.length)]
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)]

  while (chars.length < length) {
    chars.push(pick(all))
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join('')
}

// POST: Create a user with one-time password
export async function POST(request: NextRequest) {
  try {
    const admin = await requireRole('SUPER_ADMIN')
    const body = await request.json()

    const validation = createAdminUserSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Please check your input.',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const input = validation.data
    const normalizedEmail = input.email.toLowerCase()

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, deletedAt: true },
    })

    if (existingUser) {
      return NextResponse.json(
        {
          error: 'User exists',
          message: 'A user with this email already exists.',
        },
        { status: 409 }
      )
    }

    const oneTimePassword = generateOneTimePassword()
    const passwordHash = await bcrypt.hash(oneTimePassword, 12)
    const fullName = `${input.firstName} ${input.lastName}`.trim()

    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          firstName: input.firstName,
          lastName: input.lastName,
          passwordHash,
          emailVerified: new Date(),
          mustChangePassword: true,
        },
      })

      if (input.accountType === 'ORGANIZER' || input.accountType === 'SUPER_ADMIN') {
        await tx.userRole.create({
          data: {
            userId: user.id,
            role: 'ORGANIZER',
            grantedBy: admin.id,
          },
        })

        await tx.organizerProfile.create({
          data: {
            userId: user.id,
            orgName: fullName || normalizedEmail,
            description: '',
          },
        })
      }

      if (input.accountType === 'SUPER_ADMIN') {
        await tx.userRole.create({
          data: {
            userId: user.id,
            role: 'SUPER_ADMIN',
            grantedBy: admin.id,
          },
        })
      }

      return user
    })

    return NextResponse.json(
      {
        success: true,
        message: 'User created successfully.',
        data: {
          id: createdUser.id,
          email: createdUser.email,
          oneTimePassword,
          accountType: input.accountType,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Please sign in to continue.' },
          { status: 401 }
        )
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'You do not have permission.' },
          { status: 403 }
        )
      }
    }

    console.error('Create admin user error:', error)
    return NextResponse.json(
      { error: 'Request failed', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
