'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

type NavItem = {
  id: 'scan' | 'overview' | 'events' | 'adminOverview' | 'adminUsers'
  href: string
  label: string
}

function isActive(pathname: string, item: NavItem): boolean {
  switch (item.id) {
    case 'scan':
      return pathname === '/dashboard/scan' || (pathname.startsWith('/dashboard/events/') && pathname.endsWith('/scan'))
    case 'overview':
      return pathname === '/dashboard'
    case 'events':
      return pathname.startsWith('/dashboard/events') && !pathname.endsWith('/scan')
    case 'adminOverview':
      return pathname === '/dashboard/admin'
    case 'adminUsers':
      return pathname.startsWith('/dashboard/admin/users')
    default:
      return false
  }
}

export function OrganizerSidebarNav() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const isSuperAdmin = session?.user?.roles?.includes('SUPER_ADMIN')

  const navItems: NavItem[] = [
    { id: 'scan', href: '/dashboard/scan', label: 'Scan Tickets' },
    { id: 'overview', href: '/dashboard', label: 'Dashboard' },
    // Hide "Manage Events" for Super Admins - they use Admin Overview instead
    ...(isSuperAdmin ? [] : [{ id: 'events' as const, href: '/dashboard/events', label: 'Manage Events' }]),
  ]
  const adminNavItems: NavItem[] = [
    { id: 'adminOverview', href: '/dashboard/admin', label: 'Admin Overview' },
    { id: 'adminUsers', href: '/dashboard/admin/users', label: 'User Management' },
  ]

  const profileSectionActive = pathname === '/dashboard/profile' || pathname.startsWith('/dashboard/settings')
  const adminSectionActive = pathname === '/dashboard/admin' || pathname.startsWith('/dashboard/admin/users')
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
                'flex-1 rounded-md px-3 py-2 font-medium transition',
                pathname === '/dashboard/admin' ? 'bg-[#5C8BD9] text-white' : 'text-gray-700 hover:bg-gray-50'
              )}
              aria-current={pathname === '/dashboard/admin' ? 'page' : undefined}
            >
              Admin
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
                      'block rounded-md px-3 py-2 font-medium transition',
                      active ? 'bg-[#5C8BD9] text-white' : 'text-gray-700 hover:bg-gray-50'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
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
              'flex-1 rounded-md px-3 py-2 font-medium transition',
              pathname === '/dashboard/profile' ? 'bg-[#5C8BD9] text-white' : 'text-gray-700 hover:bg-gray-50'
            )}
            aria-current={pathname === '/dashboard/profile' ? 'page' : undefined}
          >
            Profile
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
                'block rounded-md px-3 py-2 font-medium transition',
                pathname.startsWith('/dashboard/settings/account') ? 'bg-[#5C8BD9] text-white' : 'text-gray-700 hover:bg-gray-50'
              )}
              aria-current={pathname.startsWith('/dashboard/settings/account') ? 'page' : undefined}
            >
              Account Settings
            </Link>
          </div>
        ) : null}
      </div>
    </nav>
  )
}
