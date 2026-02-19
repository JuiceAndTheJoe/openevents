import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { generateFileKey, getPublicUrl, getUploadPresignedUrl } from '@/lib/storage'

const presignedUploadSchema = z.object({
  entityId: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.enum([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
  ]),
  size: z.number().int().positive().max(50 * 1024 * 1024),
  folder: z.enum(['events', 'speakers']),
})

export async function POST(request: NextRequest) {
  try {
    await requireRole('ORGANIZER')

    const body = await request.json()
    const parsed = presignedUploadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { entityId, filename, contentType, folder } = parsed.data

    const key = generateFileKey(folder, entityId, filename)
    const uploadUrl = await getUploadPresignedUrl(key, contentType, 900)

    return NextResponse.json({
      data: {
        key,
        uploadUrl,
        publicUrl: getPublicUrl(key),
        expiresIn: 900,
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }

    console.error('Generate presigned upload failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    )
  }
}
