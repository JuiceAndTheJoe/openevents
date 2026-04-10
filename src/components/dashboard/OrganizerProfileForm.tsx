'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type OrganizerProfileFormProps = {
  initial: {
    userId: string
    orgName: string
    description: string | null
    logo: string | null
    website: string | null
    socialLinks: Record<string, string>
  }
  action: (formData: FormData) => Promise<void>
}

export function OrganizerProfileForm({ initial, action }: OrganizerProfileFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const localLogoPreviewUrlRef = useRef<string | null>(null)
  const [logoUrl, setLogoUrl] = useState(initial.logo || '')
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [logoVersion, setLogoVersion] = useState(() => Date.now())
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null)

  function notifyHeaderLogoUpdated(previewUrl: string | null) {
    window.dispatchEvent(
      new CustomEvent('openevents:organizer-logo-updated', {
        detail: { previewUrl },
      })
    )
  }

  function extractXmlTagValue(xml: string, tagName: string): string | null {
    const match = xml.match(new RegExp(`<${tagName}>([^<]+)</${tagName}>`))
    return match?.[1] ?? null
  }

  function formatUploadFailureMessage(responseBody: string): string {
    const code = extractXmlTagValue(responseBody, 'Code')
    const message = extractXmlTagValue(responseBody, 'Message')

    if (code === 'SignatureDoesNotMatch') {
      return 'Storage config error: invalid S3 signature/credentials for uploads.'
    }

    if (message) {
      return message
    }

    return 'Could not upload logo.'
  }

  useEffect(() => {
    return () => {
      if (localLogoPreviewUrlRef.current) {
        URL.revokeObjectURL(localLogoPreviewUrlRef.current)
      }
    }
  }, [])

  async function uploadLogo(file: File) {
    setIsUploadingLogo(true)
    setLogoUploadError(null)

    try {
      const presignedResponse = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: initial.userId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
          folder: 'users',
        }),
      })

      const presignedPayload = await presignedResponse.json()
      if (!presignedResponse.ok) {
        setLogoUploadError(presignedPayload?.error || 'Could not upload logo.')
        return
      }

      const uploadUrl = presignedPayload?.data?.uploadUrl as string | undefined
      const publicUrl = presignedPayload?.data?.publicUrl as string | undefined
      if (!uploadUrl || !publicUrl) {
        setLogoUploadError('Could not upload logo.')
        return
      }

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      })

      if (!uploadResponse.ok) {
        const responseBody = await uploadResponse.text().catch(() => '')
        setLogoUploadError(formatUploadFailureMessage(responseBody))
        return
      }

      if (localLogoPreviewUrlRef.current) {
        URL.revokeObjectURL(localLogoPreviewUrlRef.current)
      }

      const nextPreviewUrl = URL.createObjectURL(file)
      localLogoPreviewUrlRef.current = nextPreviewUrl

      setLogoUrl(publicUrl)
      setLogoPreviewUrl(nextPreviewUrl)
      setLogoVersion(Date.now())
      notifyHeaderLogoUpdated(nextPreviewUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : null
      setLogoUploadError(message || 'Could not upload logo.')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  async function onLogoSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setLogoUploadError('Please select a JPG, PNG, WEBP, or GIF image.')
      return
    }

    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      setLogoUploadError('Image must be smaller than 10MB.')
      return
    }

    await uploadLogo(file)
    event.target.value = ''
  }

  const currentLogoSrc = logoUrl
    ? (logoPreviewUrl ?? `/api/organizers/me/logo?v=${logoVersion}`)
    : null

  return (
    <form action={action} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      <h1 className="text-2xl font-bold text-gray-900">Organizer Profile</h1>

      <div>
        <Label htmlFor="orgName" required>Organization Name</Label>
        <Input id="orgName" name="orgName" defaultValue={initial.orgName} required />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          defaultValue={initial.description || ''}
          className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <Label htmlFor="website">Website</Label>
          <Input id="website" name="website" defaultValue={initial.website || ''} />
        </div>
        <div>
          <Label htmlFor="logoUpload">Logo</Label>
          <input type="hidden" name="logo" value={logoUrl} readOnly />
          <div className="mt-2 space-y-3">
            <div className="h-20 w-20 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
              {currentLogoSrc ? (
                <div
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${currentLogoSrc})` }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                  No logo
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                id="logoUpload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                  void onLogoSelected(event)
                }}
              />
              <Button
                type="button"
                variant="outline"
                isLoading={isUploadingLogo}
                onClick={() => fileInputRef.current?.click()}
              >
                {logoUrl ? 'Change Logo' : 'Upload Logo'}
              </Button>
              {logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (localLogoPreviewUrlRef.current) {
                      URL.revokeObjectURL(localLogoPreviewUrlRef.current)
                      localLogoPreviewUrlRef.current = null
                    }
                    setLogoUrl('')
                    setLogoPreviewUrl(null)
                    setLogoUploadError(null)
                    notifyHeaderLogoUpdated(null)
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
            {logoUploadError && (
              <p className="text-sm text-red-600">{logoUploadError}</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="linkedin">LinkedIn</Label>
        <Input id="linkedin" name="linkedin" defaultValue={initial.socialLinks.linkedin || ''} />
      </div>

      <Button type="submit" disabled={isUploadingLogo}>Save Profile</Button>
    </form>
  )
}
