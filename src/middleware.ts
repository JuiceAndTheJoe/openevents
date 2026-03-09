/**
 * Next.js Middleware
 *
 * Handles:
 * - CSRF protection for Server Actions
 *
 * Note: Rate limiting is handled in API routes instead of middleware
 * because ioredis is not compatible with Edge runtime.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Check if origin is valid for CSRF protection
 */
function isValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')

  // No origin header (same-origin requests from browser)
  if (!origin) {
    return true
  }

  // Check if origin matches host
  if (host) {
    try {
      const originUrl = new URL(origin)
      // Compare hostnames (ignore port for flexibility)
      if (originUrl.hostname === host.split(':')[0]) {
        return true
      }
      // Also allow localhost variations in development
      if (
        process.env.NODE_ENV === 'development' &&
        (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1')
      ) {
        return true
      }
    } catch {
      return false
    }
  }

  return false
}

export async function middleware(request: NextRequest) {
  // =========================================================================
  // CSRF Protection for Server Actions
  // =========================================================================
  // Server Actions are identified by the 'next-action' header
  const isServerAction = request.headers.get('next-action')

  if (isServerAction && request.method === 'POST') {
    if (!isValidOrigin(request)) {
      console.warn('[CSRF] Blocked cross-origin Server Action request', {
        origin: request.headers.get('origin'),
        host: request.headers.get('host'),
        action: isServerAction,
      })

      return new NextResponse('CSRF check failed', { status: 403 })
    }
  }

  const pathname = request.nextUrl.pathname
  const isApiRoute = pathname.startsWith('/api')
  const isChoosePasswordPage = pathname === '/choose-password'

  if (!isApiRoute) {
    const token = await getToken({ req: request })
    const mustChangePassword = Boolean(token && token.mustChangePassword)

    if (mustChangePassword && !isChoosePasswordPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/choose-password'
      const callbackTarget = `${pathname}${request.nextUrl.search}`
      if (callbackTarget !== '/choose-password') {
        url.searchParams.set('callbackUrl', callbackTarget)
      }
      return NextResponse.redirect(url)
    }

    if (token && !mustChangePassword && isChoosePasswordPage) {
      const roles = Array.isArray(token.roles) ? token.roles : []
      const url = request.nextUrl.clone()
      url.pathname = roles.includes('ORGANIZER') || roles.includes('SUPER_ADMIN')
        ? '/dashboard'
        : '/events'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
