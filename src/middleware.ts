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
  // TEMPORARY LAUNCH REDIRECT (remove after launch period)
  // Redirects homepage and events listing to /about page.
  // Allows specific event URLs like /events/[slug] to pass through.
  // =========================================================================
  const pathname = request.nextUrl.pathname
  if (pathname === '/' || pathname === '/events') {
    const url = request.nextUrl.clone()
    url.pathname = '/about'
    return NextResponse.redirect(url, 307) // 307 = Temporary Redirect
  }

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
