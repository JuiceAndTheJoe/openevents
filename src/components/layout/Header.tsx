'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function Header() {
  const { data: session, status } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)

  const isOrganizer = session?.user?.roles?.includes('ORGANIZER')
  const isSuperAdmin = session?.user?.roles?.includes('SUPER_ADMIN')
  const canManageEvents = Boolean(isOrganizer || isSuperAdmin)
  const avatarFallback = (session?.user?.email?.[0] || 'U').toUpperCase()
  const displayName = session?.user?.name?.trim() || session?.user?.email?.split('@')[0] || 'Account'
  const profileHref = isOrganizer ? '/dashboard/profile' : '/profile'

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

  return (
    <header className="bg-white border-b border-gray-200 print:hidden">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <span className="text-2xl font-bold text-[#5C8BD9]">OpenEvents</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-6">
            {canManageEvents && (
              <Link
                href="/create-event"
                className="inline-flex min-w-[132px] items-center justify-center rounded-lg bg-[#5C8BD9] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4a7ac8]"
              >
                Create Event
              </Link>
            )}
            {status === 'authenticated' ? (
              <>
                {canManageEvents && (
                  <Link
                    href="/dashboard"
                    className="text-gray-600 hover:text-gray-900 font-medium"
                  >
                    Dashboard
                  </Link>
                )}
                {isSuperAdmin && (
                  <Link
                    href="/admin"
                    className="text-gray-600 hover:text-gray-900 font-medium"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  href="/my-tickets"
                  className="text-gray-600 hover:text-gray-900 font-medium"
                >
                  My Tickets
                </Link>

                <div ref={accountMenuRef} className="relative">
                  <button
                    type="button"
                    className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 transition hover:bg-gray-50"
                    onClick={() => setAccountMenuOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={accountMenuOpen}
                  >
                    <div className="h-8 w-8 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                      {session.user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src="/api/users/me/avatar"
                          alt="Profile"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-600">
                          {avatarFallback}
                        </div>
                      )}
                    </div>
                    <div className="text-left leading-tight">
                      <p className="text-sm font-medium text-gray-900">{displayName}</p>
                      <p className="text-xs text-gray-500">{session.user.email}</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-gray-500 transition ${accountMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {accountMenuOpen ? (
                    <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                      <Link
                        href={profileHref}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
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
            ) : (
              <div className="flex items-center space-x-4">
                <Link href="/login">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link href="/register">
                  <Button>Get Started</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              type="button"
              className="text-gray-500 hover:text-gray-700"
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
          <div className="md:hidden py-4 space-y-2">
            {canManageEvents && (
              <Link
                href="/create-event"
                className="block rounded-lg bg-[#5C8BD9] px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#4a7ac8]"
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
                    className="block px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                )}
                <Link
                  href="/my-tickets"
                  className="block px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  My Tickets
                </Link>
                <Link
                  href={profileHref}
                  className="block px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
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
            ) : (
              <>
                <Link
                  href="/login"
                  className="block px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="block px-3 py-2 text-[#5C8BD9] font-medium hover:bg-gray-50 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        )}
      </nav>
    </header>
  )
}
