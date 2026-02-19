import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { forgotPasswordSchema } from '@/lib/validations/auth'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validationResult = forgotPasswordSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Please provide a valid email address',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { email } = validationResult.data

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // Always return success to prevent email enumeration
    const successResponse = {
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    }

    if (!user) {
      return NextResponse.json(successResponse)
    }

    // Check if user has a password (not OAuth-only)
    if (!user.passwordHash) {
      // User registered via OAuth, can't reset password
      // Still return success to prevent enumeration
      return NextResponse.json(successResponse)
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
    try {
      await sendPasswordResetEmail(user.email, resetToken)
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError)
      // Don't fail the request - user can try again
    }

    return NextResponse.json(successResponse)
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      {
        error: 'Request failed',
        message: 'An unexpected error occurred. Please try again.',
      },
      { status: 500 }
    )
  }
}
