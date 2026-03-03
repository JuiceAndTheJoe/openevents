'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type NavItem = {
  id: 'overview' | 'users'
  href: string
  label: string
}

export function AdminSidebarNav() {
  const pathname = usePathname()

  const navItems: NavItem[] = [
    { id: 'overview', href: '/admin', label: 'Overview' },
    { id: 'users', href: '/admin/users', label: 'Users' },
  ]

  return (
    <nav className="mt-3 space-y-1 text-sm">
      {navItems.map((item) => {
        const active =
          item.id === 'overview'
            ? pathname === '/admin'
            : pathname.startsWith(item.href)

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
    </nav>
  )
}
