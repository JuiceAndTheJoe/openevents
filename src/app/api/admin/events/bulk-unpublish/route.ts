import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'

const bulkUnpublishSchema = z.object({
  eventIds: z.array(z.string().min(1)).min(1, 'At least one event ID is required'),
})

export async function POST(request: NextRequest) {
  try {
    await requireRole('SUPER_ADMIN')

    const body = await request.json()
    const validationResult = bulkUnpublishSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Please provide valid event IDs.',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { eventIds } = validationResult.data

    // Update all published events to draft
    const result = await prisma.event.updateMany({
      where: {
        id: { in: eventIds },
        status: 'PUBLISHED',
        deletedAt: null,
      },
      data: {
        status: 'DRAFT',
      },
    })

    return NextResponse.json({
      success: true,
      message: `${result.count} event(s) unpublished successfully.`,
      data: {
        unpublishedCount: result.count,
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

    console.error('Bulk unpublish error:', error)
    return NextResponse.json(
      { error: 'Request failed', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
