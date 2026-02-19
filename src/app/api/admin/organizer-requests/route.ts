import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Only super admins can view organizer requests
    await requireRole('SUPER_ADMIN')

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // PENDING, APPROVED, REJECTED
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    const where: Prisma.OrganizerRequestWhereInput = {}
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      where.status = status as 'PENDING' | 'APPROVED' | 'REJECTED'
    }

    const [requests, totalCount] = await Promise.all([
      prisma.organizerRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.organizerRequest.count({ where }),
    ])

    // Fetch user details for each request
    const userIds = requests.map((r) => r.userId)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    })

    const userMap = new Map(users.map((u) => [u.id, u]))

    const enrichedRequests = requests.map((req) => ({
      id: req.id,
      userId: req.userId,
      orgName: req.orgName,
      description: req.description,
      status: req.status,
      createdAt: req.createdAt,
      reviewedAt: req.reviewedAt,
      reviewNotes: req.reviewNotes,
      user: userMap.get(req.userId) || null,
    }))

    return NextResponse.json({
      data: enrichedRequests,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasMore: page * pageSize < totalCount,
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
          { error: 'Forbidden', message: 'You do not have permission to access this resource.' },
          { status: 403 }
        )
      }
    }

    console.error('Get organizer requests error:', error)
    return NextResponse.json(
      {
        error: 'Request failed',
        message: 'An unexpected error occurred.',
      },
      { status: 500 }
    )
  }
}
