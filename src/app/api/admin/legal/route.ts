import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'

const legalContentSchema = z.object({
  html: z.string(),
  plainText: z.string(),
})

const contactContentSchema = z.object({
  email: z.string().email().or(z.literal('')),
  phone: z.string(),
  companyName: z.string(),
  address: z.string(),
  businessHours: z.string(),
})

const updateLegalSchema = z.object({
  tos: legalContentSchema.optional(),
  about: legalContentSchema.optional(),
  privacy: legalContentSchema.optional(),
  contact: contactContentSchema.optional(),
})

export async function GET() {
  try {
    await requireRole('SUPER_ADMIN')

    const settings = await prisma.platformSetting.findMany({
      where: {
        key: {
          in: ['legal_tos', 'legal_about', 'legal_privacy', 'legal_contact'],
        },
      },
    })

    const result: Record<string, unknown> = {
      tos: null,
      about: null,
      privacy: null,
      contact: null,
    }

    for (const setting of settings) {
      try {
        const parsed = JSON.parse(setting.value)
        switch (setting.key) {
          case 'legal_tos':
            result.tos = parsed
            break
          case 'legal_about':
            result.about = parsed
            break
          case 'legal_privacy':
            result.privacy = parsed
            break
          case 'legal_contact':
            result.contact = parsed
            break
        }
      } catch {
        // Skip invalid JSON
      }
    }

    return NextResponse.json({ data: result })
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

    console.error('Get legal content error:', error)
    return NextResponse.json(
      { error: 'Request failed', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole('SUPER_ADMIN')

    const body = await request.json()
    const validation = updateLegalSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Please check your input.',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const input = validation.data
    const now = new Date().toISOString()

    const updates: { key: string; value: string }[] = []

    if (input.tos) {
      updates.push({
        key: 'legal_tos',
        value: JSON.stringify({ ...input.tos, updatedAt: now }),
      })
    }

    if (input.about) {
      updates.push({
        key: 'legal_about',
        value: JSON.stringify({ ...input.about, updatedAt: now }),
      })
    }

    if (input.privacy) {
      updates.push({
        key: 'legal_privacy',
        value: JSON.stringify({ ...input.privacy, updatedAt: now }),
      })
    }

    if (input.contact) {
      updates.push({
        key: 'legal_contact',
        value: JSON.stringify({ ...input.contact, updatedAt: now }),
      })
    }

    await prisma.$transaction(
      updates.map((update) =>
        prisma.platformSetting.upsert({
          where: { key: update.key },
          create: {
            key: update.key,
            value: update.value,
            type: 'json',
          },
          update: {
            value: update.value,
          },
        })
      )
    )

    return NextResponse.json({
      success: true,
      message: 'Legal content updated successfully.',
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

    console.error('Update legal content error:', error)
    return NextResponse.json(
      { error: 'Request failed', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
