import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { choosePasswordSchema } from '@/lib/validations/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    const validation = choosePasswordSchema.safeParse(body)
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

    if (!user.mustChangePassword) {
      return NextResponse.json(
        {
          error: 'Not required',
          message: 'Password change is not required for this account.',
        },
        { status: 400 }
      )
    }

    const passwordHash = await bcrypt.hash(validation.data.password, 12)

    await prisma.user.update({
      where: { id: user.id, deletedAt: null },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully.',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to continue.' },
        { status: 401 }
      )
    }

    console.error('Choose password error:', error)
    return NextResponse.json(
      {
        error: 'Request failed',
        message: 'An unexpected error occurred. Please try again.',
      },
      { status: 500 }
    )
  }
}
