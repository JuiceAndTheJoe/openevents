'use client'

import { useState } from 'react'
import { Role } from '@prisma/client'
import { Button } from '@/components/ui/button'

type User = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  createdAt: Date
  roles: Role[]
}

type UsersTableProps = {
  users: User[]
  currentAdminId: string
}

type AccountType = 'ATTENDEE' | 'ORGANIZER' | 'SUPER_ADMIN'

function resolveAccountType(roles: Role[]): AccountType {
  if (roles.includes('SUPER_ADMIN')) return 'SUPER_ADMIN'
  if (roles.includes('ORGANIZER')) return 'ORGANIZER'
  return 'ATTENDEE'
}

export function UsersTable({ users, currentAdminId }: UsersTableProps) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedTypes, setSelectedTypes] = useState<Record<string, AccountType>>({})

  async function handleAccountTypeUpdate(userId: string, role: AccountType) {
    if (!confirm(`Are you sure you want to set account type to ${role}?`)) {
      return
    }

    setBusyId(userId)
    setError(null)

    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json?.message || json?.error || 'Failed to update account type')
      }

      window.location.reload()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-600">
        No users match the current filters.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {error ? (
        <p className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Roles</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Joined</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Account Type</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => {
              const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim()
              const isSelf = user.id === currentAdminId
              const currentType = resolveAccountType(user.roles)
              const selectedType = selectedTypes[user.id] ?? currentType
              const hasChanges = selectedType !== currentType

              return (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{fullName || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{user.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            role === 'SUPER_ADMIN'
                              ? 'bg-purple-100 text-purple-700'
                              : role === 'ORGANIZER'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={selectedType}
                      disabled={isSelf || busyId === user.id}
                      onChange={(event) => {
                        setSelectedTypes((prev) => ({
                          ...prev,
                          [user.id]: event.target.value as AccountType,
                        }))
                      }}
                      className="h-9 min-w-[150px] rounded-md border border-gray-300 bg-white px-3 text-sm"
                    >
                      <option value="ATTENDEE">ATTENDEE</option>
                      <option value="ORGANIZER">ORGANIZER</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {isSelf ? (
                        <span className="text-xs text-gray-400">You</span>
                      ) : (
                        <Button
                          size="sm"
                          isLoading={busyId === user.id}
                          disabled={!hasChanges}
                          onClick={() => handleAccountTypeUpdate(user.id, selectedType)}
                        >
                          Update
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
