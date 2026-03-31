'use client'

import { useState } from 'react'
import { Role } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toaster'

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

type AccountType = 'ORGANIZER' | 'SUPER_ADMIN'

function resolveAccountType(roles: Role[]): AccountType {
  if (roles.includes('SUPER_ADMIN')) return 'SUPER_ADMIN'
  return 'ORGANIZER'
}

export function UsersTable({ users, currentAdminId }: UsersTableProps) {
  const showToast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedTypes, setSelectedTypes] = useState<Record<string, AccountType>>({})
  const [pendingDeactivate, setPendingDeactivate] = useState<{ id: string; email: string } | null>(null)

  async function handleAccountTypeUpdate(userId: string, role: AccountType) {
    if (!confirm(`Are you sure you want to set account type to ${role}?`)) {
      return
    }

    setBusyId(userId)
    setBusyAction('role')
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
      setBusyAction(null)
    }
  }

  async function handleResetPassword(userId: string) {
    setBusyId(userId)
    setBusyAction('reset')
    setError(null)

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json?.message || json?.error || 'Failed to send reset email')
      }

      showToast('Password reset email sent', 'success')
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action failed')
    } finally {
      setBusyId(null)
      setBusyAction(null)
    }
  }

  async function handleDeactivate(userId: string) {
    setBusyId(userId)
    setBusyAction('deactivate')
    setError(null)

    try {
      const response = await fetch(`/api/admin/users/${userId}/deactivate`, {
        method: 'POST',
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json?.message || json?.error || 'Failed to deactivate user')
      }

      showToast('User account deactivated', 'success')
      window.location.reload()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action failed')
    } finally {
      setBusyId(null)
      setBusyAction(null)
      setPendingDeactivate(null)
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
                    {isSelf ? (
                      <span className="inline-block h-9 min-w-[150px] rounded-md border border-gray-200 bg-gray-50 px-3 text-sm leading-9 text-gray-600">
                        {currentType}
                      </span>
                    ) : (
                      <select
                        value={selectedType}
                        disabled={busyId === user.id}
                        onChange={(event) => {
                          setSelectedTypes((prev) => ({
                            ...prev,
                            [user.id]: event.target.value as AccountType,
                          }))
                        }}
                        className="h-9 min-w-[150px] rounded-md border border-gray-300 bg-white px-3 text-sm"
                      >
                        <option value="ORGANIZER">ORGANIZER</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {isSelf ? (
                        <span className="text-xs text-gray-400">You</span>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            isLoading={busyId === user.id && busyAction === 'role'}
                            disabled={!hasChanges || (busyId === user.id && busyAction !== 'role')}
                            onClick={() => handleAccountTypeUpdate(user.id, selectedType)}
                          >
                            Update
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            isLoading={busyId === user.id && busyAction === 'reset'}
                            disabled={busyId === user.id && busyAction !== 'reset'}
                            onClick={() => handleResetPassword(user.id)}
                          >
                            Reset Password
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            isLoading={busyId === user.id && busyAction === 'deactivate'}
                            disabled={busyId === user.id && busyAction !== 'deactivate'}
                            onClick={() => setPendingDeactivate({ id: user.id, email: user.email })}
                          >
                            Deactivate
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={pendingDeactivate !== null}
        title="Deactivate User Account"
        description={`This will permanently deactivate ${pendingDeactivate?.email}. All their events will be cancelled, orders refunded, and their account anonymized. This action cannot be undone.`}
        confirmLabel="Deactivate"
        isLoading={busyId === pendingDeactivate?.id && busyAction === 'deactivate'}
        onConfirm={() => {
          if (pendingDeactivate) handleDeactivate(pendingDeactivate.id)
        }}
        onClose={() => setPendingDeactivate(null)}
      />
    </div>
  )
}
