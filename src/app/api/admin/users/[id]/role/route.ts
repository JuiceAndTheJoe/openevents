import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { Role } from '@prisma/client'

const roleUpdateSchema = z.object({
  role: z.enum(['ORGANIZER', 'SUPER_ADMIN']),
})

function resolveTargetRoles(role: Role): Role[] {
  if (role === 'SUPER_ADMIN') {
    return ['ORGANIZER', 'SUPER_ADMIN']
  }

  return ['ORGANIZER']
}

// POST: Set account type for a user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole('SUPER_ADMIN')

    const { id } = await params
    const body = await request.json()

    const validationResult = roleUpdateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Please provide a valid account type.',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { role } = validationResult.data

    const user = await prisma.user.findUnique({
      where: { id, deletedAt: null },
      include: { roles: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Not found', message: 'User not found.' },
        { status: 404 }
      )
    }

    if (user.id === admin.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You cannot modify your own account type.' },
        { status: 403 }
      )
    }

    const currentRoles = user.roles.map((entry) => entry.role)
    const targetRoles = resolveTargetRoles(role)

    const removingSuperAdmin = currentRoles.includes('SUPER_ADMIN') && !targetRoles.includes('SUPER_ADMIN')
    if (removingSuperAdmin) {
      const superAdminCount = await prisma.userRole.count({
        where: { role: 'SUPER_ADMIN' },
      })

      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'At least one super admin is required.' },
          { status: 400 }
        )
      }
    }

    await prisma.$transaction(async (tx) => {
      const toCreate = targetRoles.filter((r) => !currentRoles.includes(r))
      const toDelete = currentRoles.filter((r) => !targetRoles.includes(r))

      for (const roleToCreate of toCreate) {
        await tx.userRole.create({
          data: {
            userId: user.id,
            role: roleToCreate,
            grantedBy: admin.id,
          },
        })
      }

      if (toDelete.length > 0) {
        await tx.userRole.deleteMany({
          where: {
            userId: user.id,
            role: { in: toDelete },
          },
        })
      }

      if (targetRoles.includes('ORGANIZER')) {
        const existingProfile = await tx.organizerProfile.findUnique({
          where: { userId: user.id },
          select: { id: true },
        })

        if (!existingProfile) {
          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim()
          await tx.organizerProfile.create({
            data: {
              userId: user.id,
              orgName: fullName || user.email,
              description: '',
            },
          })
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Account type updated successfully.',
      data: {
        userId: user.id,
        accountType: role,
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

    console.error('Update user role error:', error)
    return NextResponse.json(
      { error: 'Request failed', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
