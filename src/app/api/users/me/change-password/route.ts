import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { changePasswordSchema } from '@/lib/validations/auth'

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await requireAuth()

    const body = await request.json()

    // Validate input
    const validationResult = changePasswordSchema.safeParse(body)
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

    const { currentPassword, newPassword } = validationResult.data

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
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
          error: 'No password',
          message: 'Your account uses social login. You cannot change your password here.',
        },
        { status: 400 }
      )
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    )

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        {
          error: 'Invalid password',
          message: 'Current password is incorrect.',
        },
        { status: 400 }
      )
    }

    // Check that new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash)
    if (isSamePassword) {
      return NextResponse.json(
        {
          error: 'Same password',
          message: 'New password must be different from current password.',
        },
        { status: 400 }
      )
    }

    // Hash new password with bcrypt (cost factor 12)
    const newPasswordHash = await bcrypt.hash(newPassword, 12)

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    })

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully.',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to continue.' },
        { status: 401 }
      )
    }

    console.error('Change password error:', error)
    return NextResponse.json(
      { error: 'Update failed', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
