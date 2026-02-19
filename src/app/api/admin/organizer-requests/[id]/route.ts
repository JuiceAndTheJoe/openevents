import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
})

// GET: Get single organizer request
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('SUPER_ADMIN')

    const { id } = await params

    const organizerRequest = await prisma.organizerRequest.findUnique({
      where: { id },
    })

    if (!organizerRequest) {
      return NextResponse.json(
        { error: 'Not found', message: 'Organizer request not found.' },
        { status: 404 }
      )
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: organizerRequest.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    })

    return NextResponse.json({
      data: {
        ...organizerRequest,
        user,
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

    console.error('Get organizer request error:', error)
    return NextResponse.json(
      { error: 'Request failed', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}

// POST: Approve or reject organizer request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole('SUPER_ADMIN')

    const { id } = await params
    const body = await request.json()

    // Validate input
    const validationResult = reviewSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Please provide a valid action (approve or reject).',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { action, notes } = validationResult.data

    // Find the request
    const organizerRequest = await prisma.organizerRequest.findUnique({
      where: { id },
    })

    if (!organizerRequest) {
      return NextResponse.json(
        { error: 'Not found', message: 'Organizer request not found.' },
        { status: 404 }
      )
    }

    if (organizerRequest.status !== 'PENDING') {
      return NextResponse.json(
        {
          error: 'Already processed',
          message: `This request has already been ${organizerRequest.status.toLowerCase()}.`,
        },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      // Approve the request in a transaction
      await prisma.$transaction(async (tx) => {
        // Update request status
        await tx.organizerRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            reviewedBy: admin.id,
            reviewedAt: new Date(),
            reviewNotes: notes,
          },
        })

        // Grant ORGANIZER role
        await tx.userRole.create({
          data: {
            userId: organizerRequest.userId,
            role: 'ORGANIZER',
            grantedBy: admin.id,
          },
        })

        // Create organizer profile
        await tx.organizerProfile.create({
          data: {
            userId: organizerRequest.userId,
            orgName: organizerRequest.orgName,
            description: organizerRequest.description,
          },
        })
      })

      // TODO: Send approval notification email

      return NextResponse.json({
        success: true,
        message: 'Organizer request approved successfully.',
      })
    } else {
      // Reject the request
      await prisma.organizerRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedBy: admin.id,
          reviewedAt: new Date(),
          reviewNotes: notes,
        },
      })

      // TODO: Send rejection notification email

      return NextResponse.json({
        success: true,
        message: 'Organizer request rejected.',
      })
    }
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

    console.error('Review organizer request error:', error)
    return NextResponse.json(
      { error: 'Request failed', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
