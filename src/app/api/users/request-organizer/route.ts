import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

const requestOrganizerSchema = z.object({
  orgName: z.string().min(2, 'Organization name must be at least 2 characters'),
  description: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Check if user already has organizer role
    if (user.roles.includes('ORGANIZER')) {
      return NextResponse.json(
        {
          error: 'Already organizer',
          message: 'You are already an organizer.',
        },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Validate input
    const validationResult = requestOrganizerSchema.safeParse(body)
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

    const { orgName, description } = validationResult.data

    // Check if user already has a pending request
    const existingRequest = await prisma.organizerRequest.findUnique({
      where: { userId: user.id },
    })

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        return NextResponse.json(
          {
            error: 'Request pending',
            message: 'You already have a pending organizer request.',
          },
          { status: 400 }
        )
      }

      if (existingRequest.status === 'REJECTED') {
        // Allow resubmission after rejection
        const updatedRequest = await prisma.organizerRequest.update({
          where: { id: existingRequest.id },
          data: {
            orgName,
            description,
            status: 'PENDING',
            reviewedBy: null,
            reviewedAt: null,
            reviewNotes: null,
          },
        })

        return NextResponse.json(
          {
            success: true,
            message: 'Your organizer request has been resubmitted.',
            data: {
              id: updatedRequest.id,
              status: updatedRequest.status,
            },
          },
          { status: 200 }
        )
      }
    }

    // Create new organizer request
    const organizerRequest = await prisma.organizerRequest.create({
      data: {
        userId: user.id,
        orgName,
        description,
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Your request to become an organizer has been submitted.',
        data: {
          id: organizerRequest.id,
          status: organizerRequest.status,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to continue.' },
        { status: 401 }
      )
    }

    console.error('Request organizer error:', error)
    return NextResponse.json(
      {
        error: 'Request failed',
        message: 'An unexpected error occurred. Please try again.',
      },
      { status: 500 }
    )
  }
}

// GET: Check current request status
export async function GET() {
  try {
    const user = await requireAuth()

    const request = await prisma.organizerRequest.findUnique({
      where: { userId: user.id },
    })

    if (!request) {
      return NextResponse.json({
        data: null,
        message: 'No organizer request found.',
      })
    }

    return NextResponse.json({
      data: {
        id: request.id,
        orgName: request.orgName,
        description: request.description,
        status: request.status,
        createdAt: request.createdAt,
        reviewedAt: request.reviewedAt,
        reviewNotes: request.reviewNotes,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to continue.' },
        { status: 401 }
      )
    }

    console.error('Get organizer request error:', error)
    return NextResponse.json(
      {
        error: 'Request failed',
        message: 'An unexpected error occurred.',
      },
      { status: 500 }
    )
  }
}
