'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

type NavItem = {
  id: 'scan' | 'overview' | 'events' | 'adminUsers' | 'adminLegal' | 'adminCustomization'
  href: string
  label: string
  badge?: 'attention'
}

function isActive(pathname: string, item: NavItem): boolean {
  switch (item.id) {
    case 'scan':
      return pathname === '/dashboard/scan' || (pathname.startsWith('/dashboard/events/') && pathname.endsWith('/scan'))
    case 'overview':
      return pathname === '/dashboard'
    case 'events':
      return pathname.startsWith('/dashboard/events') && !pathname.endsWith('/scan')
    case 'adminUsers':
      return pathname.startsWith('/dashboard/admin/users')
    case 'adminLegal':
      return pathname.startsWith('/dashboard/admin/legal')
    case 'adminCustomization':
      return pathname.startsWith('/dashboard/admin/customization')
    default:
      return false
  }
}

export function OrganizerSidebarNav() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const isSuperAdmin = session?.user?.roles?.includes('SUPER_ADMIN')
  const mustChangePassword = session?.user?.mustChangePassword ?? false
  const [legalNeedsAttention, setLegalNeedsAttention] = useState(false)
  const [customizationNeedsAttention, setCustomizationNeedsAttention] = useState(false)

  const checkLegalStatus = useCallback(() => {
    if (!isSuperAdmin) return

    fetch('/api/admin/legal')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data?.data) return
        const { tos, about, privacy, contact } = data.data
        const allDefaults = !tos?.plainText?.trim() && !about?.plainText?.trim() && !privacy?.plainText?.trim() && !contact?.email && !contact?.phone && !contact?.companyName && !contact?.address
        setLegalNeedsAttention(allDefaults)
      })
      .catch(() => {})
  }, [isSuperAdmin])

  const checkCustomizationStatus = useCallback(() => {
    if (!isSuperAdmin) return

    fetch('/api/admin/homepage')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data?.data) return
        const { heroText, heroImage } = data.data
        const isDefault = heroText === 'Events made for business' && !heroImage
        setCustomizationNeedsAttention(isDefault)
      })
      .catch(() => {})
  }, [isSuperAdmin])

  useEffect(() => {
    checkLegalStatus()
    checkCustomizationStatus()

    window.addEventListener('legal-content-updated', checkLegalStatus)
    window.addEventListener('customization-updated', checkCustomizationStatus)
    return () => {
      window.removeEventListener('legal-content-updated', checkLegalStatus)
      window.removeEventListener('customization-updated', checkCustomizationStatus)
    }
  }, [checkLegalStatus, checkCustomizationStatus])

  const navItems: NavItem[] = [
    { id: 'scan', href: '/dashboard/scan', label: 'Scan Tickets' },
    { id: 'overview', href: '/dashboard', label: 'Dashboard' },
    { id: 'events', href: '/dashboard/events', label: 'Manage Events' },
  ]
  const adminNavItems: NavItem[] = [
    { id: 'adminUsers', href: '/dashboard/admin/users', label: 'User Management' },
    { id: 'adminLegal', href: '/dashboard/admin/legal', label: 'Legal & Contact', badge: legalNeedsAttention ? 'attention' : undefined },
    { id: 'adminCustomization', href: '/dashboard/admin/customization', label: 'Platform Customization', badge: customizationNeedsAttention ? 'attention' : undefined },
  ]

  const profileSectionActive = pathname === '/dashboard/profile' || pathname.startsWith('/dashboard/settings')
  const adminSectionActive = pathname === '/dashboard/admin' || pathname.startsWith('/dashboard/admin/users') || pathname.startsWith('/dashboard/admin/legal') || pathname.startsWith('/dashboard/admin/customization')
  const [adminMenuExpanded, setAdminMenuExpanded] = useState(false)
  const [adminMenuOverride, setAdminMenuOverride] = useState<{ path: string; open: boolean } | null>(null)
  const autoAdminOpen = adminMenuExpanded || adminSectionActive
  const adminOpen = adminMenuOverride?.path === pathname ? adminMenuOverride.open : autoAdminOpen
  const [profileMenuExpanded, setProfileMenuExpanded] = useState(false)
  const [profileMenuOverride, setProfileMenuOverride] = useState<{ path: string; open: boolean } | null>(null)
  const autoProfileOpen = profileMenuExpanded || profileSectionActive
  const profileOpen = profileMenuOverride?.path === pathname ? profileMenuOverride.open : autoProfileOpen

  return (
    <nav className="mt-3 space-y-1 text-sm">
      {navItems.map((item) => {
        const active = isActive(pathname, item)

        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              'block rounded-md px-3 py-2 font-medium transition',
              active ? 'bg-[#5C8BD9] text-white' : 'text-gray-700 hover:bg-gray-50'
            )}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        )
      })}

      {isSuperAdmin ? (
        <div className="pt-1">
          <div className="flex items-center gap-1">
            <Link
              href="/dashboard/admin"
              className={cn(
                'flex-1 rounded-md px-3 py-2 font-medium transition flex items-center justify-between',
                pathname === '/dashboard/admin' ? 'bg-[#5C8BD9] text-white' : 'text-gray-700 hover:bg-gray-50'
              )}
              aria-current={pathname === '/dashboard/admin' ? 'page' : undefined}
            >
              Admin
              {!adminOpen && (legalNeedsAttention || customizationNeedsAttention) && (
                <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="Items need attention" />
              )}
            </Link>
            <button
              type="button"
              className="rounded-md p-2 text-gray-600 transition hover:bg-gray-50"
              aria-label={adminOpen ? 'Collapse admin links' : 'Expand admin links'}
              aria-expanded={adminOpen}
              onClick={() => {
                const nextOpen = !adminOpen
                setAdminMenuExpanded(nextOpen)
                setAdminMenuOverride({ path: pathname, open: nextOpen })
              }}
            >
              <ChevronDown className={cn('h-4 w-4 transition', adminOpen ? 'rotate-180' : '')} />
            </button>
          </div>

          {adminOpen ? (
            <div className="ml-3 mt-1 space-y-1 border-l border-gray-200 pl-3">
              {adminNavItems.map((item) => {
                const active = isActive(pathname, item)

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center justify-between rounded-md px-3 py-2 font-medium transition',
                      active ? 'bg-[#5C8BD9] text-white' : 'text-gray-700 hover:bg-gray-50'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                    {item.badge === 'attention' && (
                      <>
                        <span
                          className="h-2 w-2 rounded-full bg-amber-500"
                          aria-label="Needs attention"
                        />
                        <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                          Using default content. Customize for your organization.
                        </span>
                      </>
                    )}
                  </Link>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="pt-1">
        <div className="flex items-center gap-1">
          <Link
            href="/dashboard/profile"
            className={cn(
              'flex-1 rounded-md px-3 py-2 font-medium transition flex items-center justify-between',
              pathname === '/dashboard/profile' ? 'bg-[#5C8BD9] text-white' : 'text-gray-700 hover:bg-gray-50'
            )}
            aria-current={pathname === '/dashboard/profile' ? 'page' : undefined}
          >
            Profile
            {!profileOpen && mustChangePassword && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
            )}
          </Link>
          <button
            type="button"
            className="rounded-md p-2 text-gray-600 transition hover:bg-gray-50"
            aria-label={profileOpen ? 'Collapse profile links' : 'Expand profile links'}
            aria-expanded={profileOpen}
            onClick={() => {
              const nextOpen = !profileOpen
              setProfileMenuExpanded(nextOpen)
              setProfileMenuOverride({ path: pathname, open: nextOpen })
            }}
          >
            <ChevronDown className={cn('h-4 w-4 transition', profileOpen ? 'rotate-180' : '')} />
          </button>
        </div>

        {profileOpen ? (
          <div className="ml-3 mt-1 space-y-1 border-l border-gray-200 pl-3">
            <Link
              href="/dashboard/settings"
              className={cn(
                'block rounded-md px-3 py-2 font-medium transition',
                pathname === '/dashboard/settings' ? 'bg-[#5C8BD9] text-white' : 'text-gray-700 hover:bg-gray-50'
              )}
              aria-current={pathname === '/dashboard/settings' ? 'page' : undefined}
            >
              Profile Settings
            </Link>
            <Link
              href="/dashboard/settings/account"
              className={cn(
                'group relative flex items-center justify-between rounded-md px-3 py-2 font-medium transition',
                pathname.startsWith('/dashboard/settings/account') ? 'bg-[#5C8BD9] text-white' : 'text-gray-700 hover:bg-gray-50'
              )}
              aria-current={pathname.startsWith('/dashboard/settings/account') ? 'page' : undefined}
            >
              Account Settings
              {mustChangePassword && (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  </span>
                  <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                    Please change your default password
                  </span>
                </>
              )}
            </Link>
          </div>
        ) : null}
      </div>
    </nav>
  )
}
