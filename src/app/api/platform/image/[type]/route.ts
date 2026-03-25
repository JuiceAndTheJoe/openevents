import { NextRequest, NextResponse } from 'next/server'
import { getPlatformSettings } from '@/lib/platform-settings'
import { getDownloadPresignedUrl } from '@/lib/storage'
import { extractObjectKeyFromStorageRef } from '@/lib/storage/object-key'

const SETTING_MAP: Record<string, string> = {
  hero: 'homepage_hero_image',
  logo: 'platform_logo',
  favicon: 'platform_favicon',
}

type RouteContext = {
  params: Promise<{ type: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { type } = await context.params
    const settingKey = SETTING_MAP[type]

    if (!settingKey) {
      return NextResponse.json({ error: 'Invalid image type' }, { status: 400 })
    }

    const settings = await getPlatformSettings({ [settingKey]: '' })
    const imageUrl = settings[settingKey]

    if (!imageUrl) {
      return NextResponse.json({ error: 'No image configured' }, { status: 404 })
    }

    const key = extractObjectKeyFromStorageRef(imageUrl, ['platform'])
    if (!key) {
      return NextResponse.json({ error: 'Invalid image reference' }, { status: 400 })
    }

    const signedUrl = await getDownloadPresignedUrl(key, 900)
    return NextResponse.redirect(signedUrl, {
      headers: {
        'Cache-Control': 'private, max-age=600',
      },
    })
  } catch (error) {
    console.error('Platform image proxy failed:', error)
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 })
  }
}
