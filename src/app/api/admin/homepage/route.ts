import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { getPlatformSettings, setPlatformSetting } from '@/lib/platform-settings'

const SETTINGS_DEFAULTS = {
  homepage_hero_text: 'Events made for business',
  homepage_hero_image: '',
  homepage_event_layout: 'showcase',
  platform_theme: 'light',
  platform_name: 'OpenEvents',
  platform_logo: '',
  platform_favicon: '',
  platform_brand_color: '#5C8BD9',
  footer_tagline: 'Organizing events starts here',
  footer_links: '',
}

const updateSettingsSchema = z.object({
  heroText: z.string().min(1).max(200),
  heroImage: z.string().max(2000).optional(),
  eventLayout: z.enum(['showcase', 'grid', 'carousel']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  platformName: z.string().min(1).max(100).optional(),
  platformLogo: z.string().max(2000).optional(),
  platformFavicon: z.string().max(2000).optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').optional(),
  footerTagline: z.string().max(200).optional(),
  footerLinks: z.array(z.object({
    label: z.string().min(1).max(100),
    href: z.string().min(1).max(500),
    external: z.boolean().optional(),
  })).optional(),
})

export async function GET() {
  try {
    await requireRole(['SUPER_ADMIN'])

    const settings = await getPlatformSettings(SETTINGS_DEFAULTS)

    return NextResponse.json({
      data: {
        heroText: settings.homepage_hero_text,
        heroImage: settings.homepage_hero_image,
        eventLayout: settings.homepage_event_layout,
        theme: settings.platform_theme,
        platformName: settings.platform_name,
        platformLogo: settings.platform_logo,
        platformFavicon: settings.platform_favicon,
        brandColor: settings.platform_brand_color,
        footerTagline: settings.footer_tagline,
        footerLinks: settings.footer_links ? JSON.parse(settings.footer_links) : null,
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
    const parsed = updateSettingsSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { heroText, heroImage, eventLayout, theme, platformName, platformLogo, platformFavicon, brandColor } = parsed.data

    await setPlatformSetting('homepage_hero_text', heroText)
    if (heroImage !== undefined) await setPlatformSetting('homepage_hero_image', heroImage)
    if (eventLayout !== undefined) await setPlatformSetting('homepage_event_layout', eventLayout)
    if (theme !== undefined) await setPlatformSetting('platform_theme', theme)
    if (platformName !== undefined) await setPlatformSetting('platform_name', platformName)
    if (platformLogo !== undefined) await setPlatformSetting('platform_logo', platformLogo)
    if (platformFavicon !== undefined) await setPlatformSetting('platform_favicon', platformFavicon)
    if (brandColor !== undefined) await setPlatformSetting('platform_brand_color', brandColor)
    if (parsed.data.footerTagline !== undefined) await setPlatformSetting('footer_tagline', parsed.data.footerTagline)
    if (parsed.data.footerLinks !== undefined) await setPlatformSetting('footer_links', JSON.stringify(parsed.data.footerLinks), 'json')
    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (error.message.includes('Forbidden'))
        return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Update settings failed:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
