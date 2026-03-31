'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AccountType = 'ORGANIZER' | 'SUPER_ADMIN'

type CreatedUserData = {
  email: string
  oneTimePassword: string
  accountType: AccountType
}

export function CreateUserForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedUserData | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('ORGANIZER')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setIsLoading(true)
    setError(null)
    setCreated(null)

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          accountType,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        setError(result?.message || 'Could not create user.')
        return
      }

      const data = result?.data as CreatedUserData
      setCreated(data)
      setFirstName('')
      setLastName('')
      setEmail('')
      setAccountType('ORGANIZER')
    } catch {
      setError('Could not create user.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-gray-900">Create Account (One-time Password)</h2>
      <p className="mt-1 text-sm text-gray-600">
        The new user signs in once with a generated one-time password and must set a new password.
      </p>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {created ? (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-800">Account created.</p>
          <p className="mt-1 text-sm text-green-700">
            Email: <span className="font-medium">{created.email}</span>
          </p>
          <p className="mt-1 text-sm text-green-700">
            Account type: <span className="font-medium">{created.accountType}</span>
          </p>
          <p className="mt-2 text-sm text-green-700">
            One-time password: <span className="font-mono font-semibold">{created.oneTimePassword}</span>
          </p>
          <p className="mt-2 text-xs text-green-700">
            Share this password securely with the user. They must change it at first login.
          </p>
        </div>
      ) : null}

      <form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="create-first-name" required>First Name</Label>
          <Input
            id="create-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="John"
            required
          />
        </div>

        <div>
          <Label htmlFor="create-last-name" required>Last Name</Label>
          <Input
            id="create-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Doe"
            required
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="create-email" required>Email</Label>
          <Input
            id="create-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@example.com"
            required
          />
        </div>

        <div>
          <Label htmlFor="create-account-type" required>Account Type</Label>
          <select
            id="create-account-type"
            className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
            value={accountType}
            onChange={(event) => setAccountType(event.target.value as AccountType)}
            required
          >
            <option value="ORGANIZER">ORGANIZER</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </select>
        </div>

        <div className="flex items-end justify-start md:justify-end">
          <Button type="submit" isLoading={isLoading}>
            Create Account
          </Button>
        </div>
      </form>
    </div>
  )
}
