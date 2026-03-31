'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

type HeaderProps = {
  platformName?: string
  platformLogo?: string
  brandColor?: string
}

export function Header({ platformName = 'OpenEvents', platformLogo, brandColor }: HeaderProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [failedAvatarSrc, setFailedAvatarSrc] = useState<string | null>(null)
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now())
  const [organizerAvatarPreview, setOrganizerAvatarPreview] = useState<string | null>(null)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)

  const isOrganizer = session?.user?.roles?.includes('ORGANIZER')
  const isSuperAdmin = session?.user?.roles?.includes('SUPER_ADMIN')
  const canManageEvents = Boolean(isOrganizer || isSuperAdmin)
  const avatarFallback = (session?.user?.email?.[0] || 'U').toUpperCase()
  const displayName = session?.user?.name?.trim() || session?.user?.email?.split('@')[0] || 'Account'
  const profileHref = '/dashboard/profile'
  const avatarSrc = organizerAvatarPreview
    ? organizerAvatarPreview
    : isOrganizer
      ? `/api/organizers/me/logo?v=${avatarVersion}`
      : `/api/users/me/avatar?v=${avatarVersion}`
  const shouldRenderAvatarImage = status === 'authenticated' && failedAvatarSrc !== avatarSrc && (isOrganizer || Boolean(session?.user?.image))

  // Determine route context for conditional rendering
  const isOrganizerRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/admin')
  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/verify-email') ||
    pathname.startsWith('/choose-password')

  // Show full auth UI (login/register buttons) on organizer routes.
  // On public pages and auth pages, keep header minimal for logged-out users.
  const isPublicPage = !isOrganizerRoute && !isAuthPage

  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!accountMenuRef.current) return
      if (!accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    function onOrganizerLogoUpdated(event: Event) {
      const detail = (event as CustomEvent<{ previewUrl?: string | null }>).detail
      setOrganizerAvatarPreview(detail?.previewUrl || null)
      setFailedAvatarSrc(null)
      setAvatarVersion(Date.now())
    }

    window.addEventListener('openevents:organizer-logo-updated', onOrganizerLogoUpdated)
    return () => {
      window.removeEventListener('openevents:organizer-logo-updated', onOrganizerLogoUpdated)
    }
  }, [])

  return (
    <header className="bg-white border-b border-gray-200 print:hidden">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              {platformLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={platformLogo} alt={platformName} className="h-8 w-auto sm:h-9" />
              ) : (
                <span className="text-xl font-bold sm:text-2xl" style={{ color: brandColor || 'var(--brand-color)' }}>{platformName}</span>
              )}
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-6">
            {canManageEvents && (
              <Link
                href="/create-event"
                className="inline-flex min-w-[132px] items-center justify-center rounded-lg bg-[#5C8BD9] px-4 py-2 text-sm font-semibold tracking-wide text-white shadow-sm transition hover:bg-[#4a7ac8]"
              >
                Create Event
              </Link>
            )}
            {status === 'authenticated' ? (
              <>
                {canManageEvents && (
                  <Link
                    href="/dashboard"
                    className={pathname.startsWith('/dashboard') ? 'text-[#5C8BD9] font-semibold' : 'text-gray-600 hover:text-gray-900 font-medium'}
                  >
                    Dashboard
                  </Link>
                )}
                <div ref={accountMenuRef} className="relative">
                  <button
                    type="button"
                    className="inline-flex max-w-[260px] items-center gap-2 rounded-full border border-gray-200 bg-white px-2 py-1.5 transition hover:bg-gray-50 lg:max-w-none lg:gap-3 lg:px-2.5"
                    onClick={() => setAccountMenuOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={accountMenuOpen}
                  >
                    <div className="h-8 w-8 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                      {shouldRenderAvatarImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarSrc}
                          alt="Profile"
                          className="h-full w-full object-cover"
                          onError={() => setFailedAvatarSrc(avatarSrc)}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-600">
                          {avatarFallback}
                        </div>
                      )}
                    </div>
                    <div className="hidden min-w-0 text-left leading-tight sm:block">
                      <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
                      <p className="hidden truncate text-xs text-gray-500 lg:block">{session.user.email}</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-gray-500 transition ${accountMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {accountMenuOpen ? (
                    <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                      <Link
                        href={profileHref}
                        className={`block px-4 py-2 text-sm ${pathname.startsWith(profileHref) ? 'text-[#5C8BD9] font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        View profile
                      </Link>
                      <button
                        type="button"
                        className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          setAccountMenuOpen(false)
                          signOut({ callbackUrl: '/' })
                        }}
                      >
                        Sign out
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : status === 'unauthenticated' ? (
              isAuthPage || isPublicPage ? null : (
                <div className="flex items-center space-x-4">
                  <Link href="/login">
                    <Button variant="ghost" className={pathname === '/login' ? 'text-[#5C8BD9] font-semibold' : ''}>Sign In</Button>
                  </Link>
                  <Link href="/register">
                    <Button className={`tracking-wide ${pathname === '/register' ? 'font-semibold' : ''}`}>Get Started</Button>
                  </Link>
                </div>
              )
            ) : null}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              type="button"
              className="rounded-md p-1 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="sr-only">Open menu</span>
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="space-y-2 border-t border-gray-100 py-4 md:hidden">
            {canManageEvents && (
              <Link
                href="/create-event"
                className="block rounded-lg bg-[#5C8BD9] px-3 py-2.5 text-center text-sm font-semibold tracking-wide text-white hover:bg-[#4a7ac8]"
                onClick={() => setMobileMenuOpen(false)}
              >
                Create Event
              </Link>
            )}

            {status === 'authenticated' ? (
              <>
                {canManageEvents && (
                  <Link
                    href="/dashboard"
                    className={`block px-3 py-2 rounded-md ${pathname.startsWith('/dashboard') ? 'text-[#5C8BD9] font-semibold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                )}
                <Link
                  href={profileHref}
                  className={`block px-3 py-2 rounded-md ${pathname.startsWith(profileHref) ? 'text-[#5C8BD9] font-semibold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  View profile
                </Link>
                <button
                  className="block w-full text-left px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    signOut({ callbackUrl: '/' })
                  }}
                >
                  Sign out
                </button>
              </>
            ) : status === 'unauthenticated' ? (
              isAuthPage || isPublicPage ? null : (
                <>
                  <Link
                    href="/login"
                    className={`block px-3 py-2 rounded-md ${pathname === '/login' ? 'text-[#5C8BD9] font-semibold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className={`block px-3 py-2 rounded-md tracking-wide text-[#5C8BD9] ${pathname === '/register' ? 'font-semibold' : 'font-medium hover:bg-gray-50'}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </>
              )
            ) : null}
          </div>
        )}
      </nav>
    </header>
  )
}
