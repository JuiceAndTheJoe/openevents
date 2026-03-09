import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { resetPasswordSchema } from '@/lib/validations/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validationResult = resetPasswordSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Please check your input',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { token, password } = validationResult.data

    // Find the password reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!resetToken) {
      return NextResponse.json(
        {
          error: 'Invalid token',
          message: 'This password reset link is invalid or has already been used.',
        },
        { status: 400 }
      )
    }

    // Check if token has expired (1 hour)
    if (resetToken.expires < new Date()) {
      // Delete expired token
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      })

      return NextResponse.json(
        {
          error: 'Token expired',
          message: 'This password reset link has expired. Please request a new one.',
        },
        { status: 400 }
      )
    }

    // Hash new password with bcrypt (cost factor 12)
    const passwordHash = await bcrypt.hash(password, 12)

    // Update password and delete token in a transaction
    await prisma.$transaction(async (tx) => {
      // Update user's password
      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          mustChangePassword: false,
        },
      })

      // Delete the used token
      await tx.passwordResetToken.delete({
        where: { id: resetToken.id },
      })

      // Delete all other password reset tokens for this user
      await tx.passwordResetToken.deleteMany({
        where: { userId: resetToken.userId },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Your password has been reset successfully. You can now log in with your new password.',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      {
        error: 'Reset failed',
        message: 'An unexpected error occurred. Please try again.',
      },
      { status: 500 }
    )
  }
}

// GET endpoint to validate token before showing reset form
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'No token provided' },
        { status: 400 }
      )
    }

    // Find the password reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    })

    if (!resetToken) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired token' },
        { status: 400 }
      )
    }

    // Check if token has expired
    if (resetToken.expires < new Date()) {
      // Delete expired token
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      })

      return NextResponse.json(
        { valid: false, error: 'Token has expired' },
        { status: 400 }
      )
    }

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('Token validation error:', error)
    return NextResponse.json(
      { valid: false, error: 'Validation failed' },
      { status: 500 }
    )
  }
}
