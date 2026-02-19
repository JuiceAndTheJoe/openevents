import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(
        new URL('/login?error=missing_token', request.url)
      )
    }

    // Find the verification token
    const verificationToken = await prisma.userVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!verificationToken) {
      return NextResponse.redirect(
        new URL('/login?error=invalid_token', request.url)
      )
    }

    // Check if token has expired (24 hours)
    if (verificationToken.expires < new Date()) {
      // Delete expired token
      await prisma.userVerificationToken.delete({
        where: { id: verificationToken.id },
      })

      return NextResponse.redirect(
        new URL('/login?error=token_expired', request.url)
      )
    }

    // Check if user is already verified
    if (verificationToken.user.emailVerified) {
      // Delete the token since it's no longer needed
      await prisma.userVerificationToken.delete({
        where: { id: verificationToken.id },
      })

      return NextResponse.redirect(
        new URL('/login?message=already_verified', request.url)
      )
    }

    // Update user's emailVerified field and delete the token in a transaction
    await prisma.$transaction(async (tx) => {
      // Update user
      await tx.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: new Date() },
      })

      // Delete used token
      await tx.userVerificationToken.delete({
        where: { id: verificationToken.id },
      })
    })

    // Redirect to login with success message
    return NextResponse.redirect(
      new URL('/login?verified=true', request.url)
    )
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.redirect(
      new URL('/login?error=verification_failed', request.url)
    )
  }
}

// Also support POST for resending verification email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      // Don't reveal if email exists
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a verification link has been sent.',
      })
    }

    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Your email is already verified. You can log in.',
      })
    }

    // Delete any existing verification tokens
    await prisma.userVerificationToken.deleteMany({
      where: { userId: user.id },
    })

    // Generate new verification token
    const crypto = await import('crypto')
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create new token
    await prisma.userVerificationToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expires: tokenExpiry,
      },
    })

    // Send verification email
    const { sendVerificationEmail } = await import('@/lib/email')
    await sendVerificationEmail(user.email, verificationToken)

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a verification link has been sent.',
    })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      {
        error: 'Failed to resend verification email',
        message: 'Please try again later.',
      },
      { status: 500 }
    )
  }
}
