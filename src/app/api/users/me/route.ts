import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { updateProfileSchema } from '@/lib/validations/auth'

// GET: Get current user profile
export async function GET() {
  try {
    const sessionUser = await requireAuth()

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        roles: true,
        organizerProfile: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Not found', message: 'User not found.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        image: user.image,
        emailVerified: user.emailVerified,
        roles: user.roles.map((r) => r.role),
        organizerProfile: user.organizerProfile
          ? {
              id: user.organizerProfile.id,
              orgName: user.organizerProfile.orgName,
              description: user.organizerProfile.description,
              logo: user.organizerProfile.logo,
              website: user.organizerProfile.website,
              socialLinks: user.organizerProfile.socialLinks,
            }
          : null,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to continue.' },
        { status: 401 }
      )
    }

    console.error('Get profile error:', error)
    return NextResponse.json(
      { error: 'Request failed', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}

// PATCH: Update current user profile
export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await requireAuth()

    const body = await request.json()

    // Validate input
    const validationResult = updateProfileSchema.safeParse(body)
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

    const data = validationResult.data

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.lastName !== undefined) updateData.lastName = data.lastName
    if (data.image !== undefined) updateData.image = data.image

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No changes', message: 'No fields to update.' },
        { status: 400 }
      )
    }

    const updatedUser = await prisma.user.update({
      where: { id: sessionUser.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        image: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully.',
      data: updatedUser,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to continue.' },
        { status: 401 }
      )
    }

    console.error('Update profile error:', error)
    return NextResponse.json(
      { error: 'Update failed', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
