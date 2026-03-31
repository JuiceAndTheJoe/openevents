import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { registerSchema } from '@/lib/validations/auth'
import { sendVerificationEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validationResult = registerSchema.safeParse(body)
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

    // Only extract safe fields - ignore any role from client to prevent privilege escalation
    // Admins assign organizer roles directly via the admin panel
    const { email, password, firstName, lastName } = validationResult.data

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        {
          error: 'User exists',
          message: 'An account with this email already exists',
        },
        { status: 409 }
      )
    }

    // Hash password with bcrypt (cost factor 12 as per ARCHITECTURE.md)
    const passwordHash = await bcrypt.hash(password, 12)

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create user and verification token in a transaction
    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          firstName,
          lastName,
        },
      })

      // Create verification token
      await tx.userVerificationToken.create({
        data: {
          userId: newUser.id,
          token: verificationToken,
          expires: tokenExpiry,
        },
      })

      return newUser
    })

    // Send verification email
    try {
      await sendVerificationEmail(user.email, verificationToken)
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
      // Don't fail the registration if email fails - user can request a new one
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      {
        error: 'Registration failed',
        message: 'An unexpected error occurred. Please try again.',
      },
      { status: 500 }
    )
  }
}
