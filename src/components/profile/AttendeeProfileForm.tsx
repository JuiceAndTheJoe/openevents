'use client'

import { useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AttendeeProfileFormProps = {
  initial: {
    id: string
    email: string
    firstName: string
    lastName: string
    image: string
  }
}

export function AttendeeProfileForm({ initial }: AttendeeProfileFormProps) {
  const { update } = useSession()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [firstName, setFirstName] = useState(initial.firstName)
  const [lastName, setLastName] = useState(initial.lastName)
  const [image, setImage] = useState(initial.image)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [profilePhotoError, setProfilePhotoError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [avatarVersion, setAvatarVersion] = useState(Date.now())
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  async function uploadProfilePhoto(file: File) {
    setIsUploadingPhoto(true)
    setProfilePhotoError(null)
    setError(null)

    try {
      const presignedResponse = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: initial.id,
          filename: file.name,
          contentType: file.type,
          size: file.size,
          folder: 'users',
        }),
      })

      const presignedPayload = await presignedResponse.json()
      if (!presignedResponse.ok) {
        setProfilePhotoError(presignedPayload?.error || 'Could not upload image.')
        return
      }

      const { uploadUrl, publicUrl } = presignedPayload.data

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      })

      if (!uploadResponse.ok) {
        setProfilePhotoError('Could not upload image.')
        return
      }

      const profileResponse = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: publicUrl }),
      })

      const profilePayload = await profileResponse.json()
      if (!profileResponse.ok) {
        setProfilePhotoError(profilePayload?.message || 'Could not save profile image.')
        return
      }

      setImage(publicUrl)
      setAvatarVersion(Date.now())
      await update()
    } catch {
      setProfilePhotoError('Could not upload image.')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  async function onPhotoSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setProfilePhotoError('Please select a JPG, PNG, WEBP, or GIF image.')
      return
    }

    await uploadProfilePhoto(file)
    event.target.value = ''
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          image: image || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result?.message || 'Could not update profile.')
        return
      }

      await update()
      setAvatarVersion(Date.now())
    } catch {
      setError('Could not update profile.')
    } finally {
      setIsSaving(false)
    }
  }

  async function onChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsChangingPassword(true)
    setPasswordError(null)

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      setIsChangingPassword(false)
      return
    }

    try {
      const response = await fetch('/api/users/me/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        setPasswordError(result?.message || 'Could not update password.')
        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setPasswordError('Could not update password.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {profilePhotoError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {profilePhotoError}
              </p>
            )}

            <div className="space-y-3">
              <Label htmlFor="photoUpload">Profile Photo</Label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
                  {image ? (
                    <img
                      src={`/api/users/me/avatar?v=${avatarVersion}`}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                      No photo
                    </div>
                  )}
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    id="photoUpload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={onPhotoSelected}
                    className="hidden"
                    disabled={isUploadingPhoto}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    isLoading={isUploadingPhoto}
                  >
                    Add file
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName" required>First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" required>Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={initial.email}
                disabled
              />
            </div>

            <Button type="submit" isLoading={isSaving || isUploadingPhoto}>
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onChangePassword} className="space-y-4">
            {passwordError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {passwordError}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="currentPassword" required>Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword" required>New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" required>Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>
            </div>

            <Button type="submit" isLoading={isChangingPassword}>
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
