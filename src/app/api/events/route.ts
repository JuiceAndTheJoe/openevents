import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { createEventSchema } from '@/lib/validations/event'
import { DEFAULT_CURRENCY } from '@/lib/constants/currencies'
import { generateUniqueSlug } from '@/lib/utils'
import { normalizeNameList, buildPeopleCreateData } from '@/lib/events/utils'

async function ensureUniqueSlug(title: string): Promise<string> {
  let attempts = 0

  while (attempts < 5) {
    const slug = generateUniqueSlug(title)
    const existing = await prisma.event.findUnique({ where: { slug }, select: { id: true } })

    if (!existing) {
      return slug
    }

    attempts += 1
  }

  throw new Error('Could not generate unique slug')
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('ORGANIZER')
    const organizerProfile = await prisma.organizerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })

    if (!organizerProfile) {
      return NextResponse.json(
        { error: 'Organizer profile not found' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = createEventSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const {
      categoryIds = [],
      autoCreateFreeTicket = false,
      speakerNames,
      organizerNames,
      sponsorNames,
      speakerPhotos,
      videoUrl,
      ...input
    } = parsed.data

    const normalizedSpeakerNames = normalizeNameList(speakerNames)
    const normalizedOrganizerNames = (organizerNames || []).map((n) => n.trim())
    const normalizedSponsorNames = (sponsorNames || []).map((n) => n.trim())

    const peopleCreateData = buildPeopleCreateData(
      normalizedSpeakerNames,
      normalizedOrganizerNames,
      normalizedSponsorNames,
      speakerPhotos
    )

    if (categoryIds.length > 0) {
      const existingCategories = await prisma.category.count({
        where: { id: { in: categoryIds } },
      })

      if (existingCategories !== categoryIds.length) {
        return NextResponse.json(
          { error: 'One or more categoryIds are invalid' },
          { status: 400 }
        )
      }
    }

    const slug = await ensureUniqueSlug(input.title)

    const event = await prisma.event.create({
      data: {
        organizerId: organizerProfile.id,
        slug,
        title: input.title,
        description: input.description,
        descriptionHtml: input.descriptionHtml,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        timezone: input.timezone,
        locationType: input.locationType,
        venue: input.venue,
        address: input.address,
        city: input.city,
        state: input.state,
        country: input.country,
        postalCode: input.postalCode,
        onlineUrl: input.onlineUrl,
        coverImage: input.coverImage,
        media: (() => {
          const items = [
            ...(input.bottomImage ? [{ url: input.bottomImage, type: 'IMAGE' as const, title: 'BOTTOM_IMAGE', sortOrder: 999 }] : []),
            ...(videoUrl ? [{ url: videoUrl, type: 'VIDEO' as const, title: 'EVENT_VIDEO', sortOrder: 1000 }] : []),
          ]
          return items.length ? { create: items } : undefined
        })(),
        speakers: peopleCreateData.length
          ? {
              create: peopleCreateData,
            }
          : undefined,
        visibility: input.visibility,
        cancellationDeadlineHours: input.cancellationDeadlineHours,
        status: 'DRAFT',
        ticketTypes: autoCreateFreeTicket
          ? {
              create: [
                {
                  name: 'General Admission',
                  description: 'Default free ticket',
                  price: new Prisma.Decimal(0),
                  currency: DEFAULT_CURRENCY,
                  isVisible: true,
                },
              ],
            }
          : undefined,
        categories: categoryIds.length
          ? {
              createMany: {
                data: categoryIds.map((categoryId) => ({ categoryId })),
              },
            }
          : undefined,
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    })

    return NextResponse.json({ data: event }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }

    console.error('Create event failed:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const category = searchParams.get('category')
    const search = searchParams.get('search') || searchParams.get('query')
    const location = searchParams.get('location')

    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    const page = Math.max(Number(searchParams.get('page') || '1'), 1)
    // Support both 'limit' and 'pageSize' parameters; default 20, max 100
    const limitParam = searchParams.get('limit') || searchParams.get('pageSize') || '20'
    const pageSize = Math.min(Math.max(Number(limitParam), 1), 100)

    const where: Prisma.EventWhereInput = {
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      deletedAt: null, // Exclude soft-deleted events
    }

    if (category) {
      where.categories = {
        some: {
          OR: [
            { category: { id: category } },
            { category: { slug: category } },
            { category: { name: { equals: category, mode: 'insensitive' } } },
          ],
        },
      }
    }

    if (startDateParam || endDateParam) {
      const startDate = startDateParam ? new Date(startDateParam) : undefined
      const endDate = endDateParam ? new Date(endDateParam) : undefined

      if ((startDate && Number.isNaN(startDate.getTime())) || (endDate && Number.isNaN(endDate.getTime()))) {
        return NextResponse.json(
          { error: 'Invalid date filter' },
          { status: 400 }
        )
      }

      where.startDate = {
        gte: startDate,
        lte: endDate,
      }
    }

    if (location) {
      where.OR = [
        { venue: { contains: location, mode: 'insensitive' } },
        { city: { contains: location, mode: 'insensitive' } },
        { state: { contains: location, mode: 'insensitive' } },
        { country: { contains: location, mode: 'insensitive' } },
      ]
    }

    if (search) {
      const searchFilter: Prisma.EventWhereInput = {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }

      where.AND = where.AND ? [...(Array.isArray(where.AND) ? where.AND : [where.AND]), searchFilter] : [searchFilter]
    }

    const [events, totalCount] = await prisma.$transaction([
      prisma.event.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startDate: 'asc' },
        include: {
          organizer: {
            select: {
              orgName: true,
            },
          },
          categories: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          _count: {
            select: {
              ticketTypes: true,
            },
          },
        },
      }),
      prisma.event.count({ where }),
    ])

    const totalPages = Math.ceil(totalCount / pageSize)

    return NextResponse.json({
      data: events,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    })
  } catch (error) {
    console.error('List events failed:', error)
    return NextResponse.json(
      { error: 'Failed to list events' },
      { status: 500 }
    )
  }
}
