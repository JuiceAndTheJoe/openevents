import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AccountSettingsProps = {
  userEmail: string
  connectedAccounts: string[]
  updateEmailAction: (formData: FormData) => Promise<void>
  changePasswordAction: (formData: FormData) => Promise<void>
  deleteAccountAction: (formData: FormData) => Promise<void>
}

export function AccountSettings({ userEmail, connectedAccounts, updateEmailAction, changePasswordAction, deleteAccountAction }: AccountSettingsProps) {
  return (
    <div className="space-y-6">
      <form action={updateEmailAction} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <div>
          <Label htmlFor="email" required>Email</Label>
          <Input id="email" name="email" type="email" defaultValue={userEmail} required />
        </div>
        <Button type="submit">Update Email</Button>
      </form>

      <form action={changePasswordAction} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="currentPassword" required>Current Password</Label>
            <Input id="currentPassword" name="currentPassword" type="password" required />
          </div>
          <div>
            <Label htmlFor="newPassword" required>New Password</Label>
            <Input id="newPassword" name="newPassword" type="password" required />
          </div>
        </div>
        <Button type="submit">Change Password</Button>
      </form>

      <form action={deleteAccountAction} className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900">Delete Account</h2>
        <p className="text-sm text-red-800">This will remove your account and organizer profile. This action cannot be undone.</p>
        <input type="hidden" name="confirm" value="true" />
        <Button type="submit" variant="destructive">Delete Account</Button>
      </form>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Connected Accounts</h2>
        {connectedAccounts.length === 0 ? (
          <p className="text-sm text-gray-600">No OAuth accounts connected.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-gray-700">
            {connectedAccounts.map((provider) => (
              <li key={provider}>{provider}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
