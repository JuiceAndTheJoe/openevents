import { NextResponse } from 'next/server'
import { getPlatformSettings } from '@/lib/platform-settings'

const BRANDING_DEFAULTS = {
  platform_name: 'OpenEvents',
  platform_logo: '',
  platform_brand_color: '#5C8BD9',
}

export async function GET() {
  try {
    const settings = await getPlatformSettings(BRANDING_DEFAULTS)

    return NextResponse.json({
      data: {
        platformName: settings.platform_name,
        platformLogo: settings.platform_logo ? '/api/platform/image/logo' : '',
        brandColor: settings.platform_brand_color,
      },
    })
  } catch (error) {
    console.error('Get branding failed:', error)
    return NextResponse.json({
      data: {
        platformName: 'OpenEvents',
        platformLogo: '',
        brandColor: '#5C8BD9',
      },
    })
  }
}
