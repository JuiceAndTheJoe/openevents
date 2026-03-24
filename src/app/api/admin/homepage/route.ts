import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { getPlatformSettings, setPlatformSetting } from '@/lib/platform-settings'

const SETTINGS_DEFAULTS = {
  homepage_hero_text: 'Events made for business',
  homepage_hero_image: '',
  platform_theme: 'light',
}

const updateHomepageSchema = z.object({
  heroText: z.string().min(1).max(200),
  heroImage: z.string().max(2000).optional(),
  theme: z.enum(['light', 'dark']).optional(),
})

export async function GET() {
  try {
    await requireRole(['SUPER_ADMIN'])

    const settings = await getPlatformSettings(SETTINGS_DEFAULTS)

    return NextResponse.json({
      data: {
        heroText: settings.homepage_hero_text,
        heroImage: settings.homepage_hero_image,
        theme: settings.platform_theme,
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (error.message.includes('Forbidden'))
        return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get homepage settings failed:', error)
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['SUPER_ADMIN'])

    const body = await request.json()
    const parsed = updateHomepageSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { heroText, heroImage, theme } = parsed.data

    await setPlatformSetting('homepage_hero_text', heroText)
    if (heroImage !== undefined) {
      await setPlatformSetting('homepage_hero_image', heroImage)
    }
    if (theme !== undefined) {
      await setPlatformSetting('platform_theme', theme)
    }

    return NextResponse.json({
      data: {
        heroText,
        heroImage: heroImage ?? '',
        theme: theme ?? 'light',
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (error.message.includes('Forbidden'))
        return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Update homepage settings failed:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
