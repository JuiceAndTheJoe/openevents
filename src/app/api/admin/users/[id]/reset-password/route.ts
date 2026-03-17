import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/email'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireRole('SUPER_ADMIN')

    const { id } = await context.params

    const user = await prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        passwordHash: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Not found', message: 'User not found.' },
        { status: 404 }
      )
    }

    // Check if user has a password (not OAuth-only)
    if (!user.passwordHash) {
      return NextResponse.json(
        {
          error: 'Invalid operation',
          message: 'This user registered via OAuth and cannot reset their password.',
        },
        { status: 400 }
      )
    }

    // Delete any existing password reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    })

    // Generate password reset token (1 hour expiry)
    const resetToken = crypto.randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Create password reset token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expires: tokenExpiry,
      },
    })

    // Send password reset email
    await sendPasswordResetEmail(user.email, resetToken)

    return NextResponse.json({
      success: true,
      message: 'Password reset email sent successfully.',
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

    console.error('Admin password reset error:', error)
    return NextResponse.json(
      { error: 'Request failed', message: 'Failed to send password reset email.' },
      { status: 500 }
    )
  }
}
