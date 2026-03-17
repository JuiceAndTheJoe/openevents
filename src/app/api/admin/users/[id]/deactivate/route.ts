import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole, getCurrentUser } from '@/lib/auth'
import { finalizeAccountDeletionForUser } from '@/lib/accountDeletion'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireRole('SUPER_ADMIN')
    const admin = await getCurrentUser()

    const { id } = await context.params

    // Prevent self-deactivation
    if (admin && admin.id === id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You cannot deactivate your own account.' },
        { status: 403 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Not found', message: 'User not found.' },
        { status: 404 }
      )
    }

    // Set deletionScheduledFor to now so finalizeAccountDeletionForUser will process it
    await prisma.user.update({
      where: { id: user.id },
      data: {
        deletionScheduledFor: new Date(),
      },
    })

    // Use the existing account deletion logic which handles:
    // - Cancelling events
    // - Refunding orders
    // - Sending notifications
    // - Anonymizing user data
    const result = await finalizeAccountDeletionForUser(user.id)

    if (!result.finalized) {
      return NextResponse.json(
        { error: 'Failed', message: 'Could not deactivate the user account.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'User account deactivated successfully.',
      data: {
        eventsCancelled: result.eventsCancelled,
        attendeeNotificationsSent: result.attendeeNotificationsSent,
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

    console.error('Admin user deactivation error:', error)
    return NextResponse.json(
      { error: 'Request failed', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
