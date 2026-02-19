'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function Header() {
  const { data: session, status } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isOrganizer = session?.user?.roles?.includes('ORGANIZER')
  const isSuperAdmin = session?.user?.roles?.includes('SUPER_ADMIN')
  const isAttendee = session?.user?.roles?.includes('ATTENDEE')
  const avatarFallback = (session?.user?.email?.[0] || 'U').toUpperCase()

  return (
    <header className="bg-white border-b border-gray-200">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">OpenEvents</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-6">
            <Link
              href="/events"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Browse Events
            </Link>
            {(isOrganizer || isSuperAdmin) && (
              <Link
                href="/create-event"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Create Event
              </Link>
            )}

            {status === 'authenticated' ? (
              <>
                {(isOrganizer || isSuperAdmin) && (
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
                {isAttendee && (
                  <Link
                    href="/profile"
                    className="text-gray-600 hover:text-gray-900 font-medium"
                  >
                    Profile
                  </Link>
                )}
                <div className="flex items-center space-x-4">
                  <div className="h-8 w-8 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                    {session.user.image ? (
                      <Image
                        src="/api/users/me/avatar"
                        alt="Profile"
                        width={32}
                        height={32}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-600">
                        {avatarFallback}
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {session.user.email}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => signOut({ callbackUrl: '/' })}
                  >
                    Sign Out
                  </Button>
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
            <Link
              href="/events"
              className="block px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
              onClick={() => setMobileMenuOpen(false)}
            >
              Browse Events
            </Link>
            {(isOrganizer || isSuperAdmin) && (
              <Link
                href="/create-event"
                className="block px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
                onClick={() => setMobileMenuOpen(false)}
              >
                Create Event
              </Link>
            )}

            {status === 'authenticated' ? (
              <>
                {(isOrganizer || isSuperAdmin) && (
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
                {isAttendee && (
                  <Link
                    href="/profile"
                    className="block px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Profile
                  </Link>
                )}
                <button
                  className="block w-full text-left px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    signOut({ callbackUrl: '/' })
                  }}
                >
                  Sign Out
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
                  className="block px-3 py-2 text-blue-600 font-medium hover:bg-gray-50 rounded-md"
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
