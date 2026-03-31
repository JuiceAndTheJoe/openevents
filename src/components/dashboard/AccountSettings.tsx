'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type DeletionNotice = 'requested' | 'scheduled' | 'cancelled' | 'invalid' | 'expired' | null

type AccountSettingsProps = {
  userEmail: string
  updateEmailAction: (formData: FormData) => Promise<void>
  changePasswordAction: (formData: FormData) => Promise<void>
  deleteAccountAction: (formData: FormData) => Promise<void>
  cancelDeletionAction: (formData: FormData) => Promise<void>
  deletionRequestedAt: Date | null
  deletionScheduledFor: Date | null
  deletionNotice: DeletionNotice
}

export function AccountSettings({
  userEmail,
  updateEmailAction,
  changePasswordAction,
  deleteAccountAction,
  cancelDeletionAction,
  deletionRequestedAt,
  deletionScheduledFor,
  deletionNotice,
}: AccountSettingsProps) {
  const hasPendingConfirmation = Boolean(deletionRequestedAt) && !deletionScheduledFor
  const hasScheduledDeletion = Boolean(deletionScheduledFor)
  const scheduledForLabel = deletionScheduledFor
    ? new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(deletionScheduledFor)
    : null

  const noticeMessage =
    deletionNotice === 'requested'
      ? 'Deletion confirmation email sent. Please check your inbox.'
      : deletionNotice === 'scheduled'
        ? 'Account deletion confirmed and scheduled.'
        : deletionNotice === 'cancelled'
          ? 'Account deletion request canceled.'
          : deletionNotice === 'expired'
            ? 'Deletion confirmation link expired. Request a new one.'
            : deletionNotice === 'invalid'
              ? 'Invalid or expired account deletion link.'
              : null

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()

  function handleConfirmDelete() {
    startDeleteTransition(async () => {
      await deleteAccountAction(new FormData())
      setDeleteConfirmOpen(false)
    })
  }

  return (
    <div className="space-y-6">
      {noticeMessage ? (
        <section className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {noticeMessage}
        </section>
      ) : null}

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

      <section className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900">Delete Account</h2>

        {hasScheduledDeletion ? (
          <>
            <p className="text-sm text-red-800">
              {`Your account deletion is scheduled for ${scheduledForLabel || ''}. You can cancel this during the grace period.`}
            </p>
            <form action={cancelDeletionAction}>
              <Button type="submit" variant="outline">Cancel Deletion Request</Button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-red-800">Request account deletion by email confirmation. After confirmation, your account enters a grace period before final anonymization.</p>
            {hasPendingConfirmation ? (
              <p className="text-sm text-red-800">Check your inbox to confirm deletion. You can request another confirmation email if the previous link expired.</p>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              isLoading={isDeleting}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              {hasPendingConfirmation ? 'Resend Confirmation Email' : 'Delete Account'}
            </Button>
          </>
        )}
      </section>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={hasPendingConfirmation ? 'Resend deletion confirmation?' : 'Delete your account?'}
        description={
          hasPendingConfirmation
            ? 'A new confirmation email will be sent to your inbox. Follow the link to confirm account deletion.'
            : 'A confirmation email will be sent to your inbox. After you confirm, your account will enter a grace period before being permanently deleted. This cannot be undone.'
        }
        confirmLabel={hasPendingConfirmation ? 'Resend Email' : 'Send Confirmation Email'}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteConfirmOpen(false)}
      />
    </div>
  )
}
