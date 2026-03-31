import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { UsersTable } from '@/components/admin/UsersTable'
import { CreateUserForm } from '@/components/admin/CreateUserForm'
import { Role } from '@prisma/client'
import { WorkspacePageHeader } from '@/components/layout/WorkspaceShell'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{
  role?: string
  search?: string
  page?: string
}>

export default async function DashboardAdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
  const roleFilter = params.role || 'all'
  const searchQuery = params.search || ''
  const page = parseInt(params.page || '1', 10)
  const pageSize = 20

  const where: {
    deletedAt: null
    roles?: { some?: { role: Role }; none?: { role: Role } }
    OR?: Array<{ email?: { contains: string; mode: 'insensitive' }; firstName?: { contains: string; mode: 'insensitive' }; lastName?: { contains: string; mode: 'insensitive' } }>
  } = {
    deletedAt: null,
  }

  if (roleFilter === 'ORGANIZER') {
    where.roles = { some: { role: 'ORGANIZER' } }
  }

  if (searchQuery) {
    where.OR = [
      { email: { contains: searchQuery, mode: 'insensitive' } },
      { firstName: { contains: searchQuery, mode: 'insensitive' } },
      { lastName: { contains: searchQuery, mode: 'insensitive' } },
    ]
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        roles: {
          select: {
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  const formattedUsers = users.map((u) => ({
    ...u,
    roles: u.roles.map((r) => r.role),
  }))

  function buildUrl(newParams: Record<string, string | undefined>) {
    const merged = { role: roleFilter, search: searchQuery, page: String(page), ...newParams }
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== 'all' && value !== '1' && !(key === 'search' && value === '')) {
        query.set(key, value)
      }
    }
    const qs = query.toString()
    return `/dashboard/admin/users${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        title="User Management"
        description="Create accounts with one-time passwords and manage account types."
      />

      <CreateUserForm />

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Filter:</span>
          <div className="flex gap-1">
            <Link
              href={buildUrl({ role: 'all', page: '1' })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                roleFilter === 'all'
                  ? 'bg-[#5C8BD9] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </Link>
            <Link
              href={buildUrl({ role: 'ORGANIZER', page: '1' })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                roleFilter === 'ORGANIZER'
                  ? 'bg-[#5C8BD9] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Organizers
            </Link>
          </div>
        </div>

        <form className="flex flex-1 items-center gap-2" action="/dashboard/admin/users" method="GET">
          {roleFilter !== 'all' && <input type="hidden" name="role" value={roleFilter} />}
          <input
            type="text"
            name="search"
            placeholder="Search by name or email..."
            defaultValue={searchQuery}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#5C8BD9] focus:outline-none focus:ring-1 focus:ring-[#5C8BD9]"
          />
          <button
            type="submit"
            className="rounded-lg bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
          >
            Search
          </button>
        </form>
      </div>

      <p className="text-sm text-gray-600">
        Showing {formattedUsers.length} of {total} users
      </p>

      <UsersTable users={formattedUsers} currentAdminId={user.id} />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildUrl({ page: String(page - 1) })}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildUrl({ page: String(page + 1) })}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
