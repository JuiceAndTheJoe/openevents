'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ImageIcon, Upload, X, Loader2, Sun, Moon } from 'lucide-react'

const DEFAULT_HERO_TEXT = 'Events made for business'

export default function AdminHomepagePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [heroText, setHeroText] = useState(DEFAULT_HERO_TEXT)
  const [heroImage, setHeroImage] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/admin/homepage')
        if (res.ok) {
          const { data } = await res.json()
          setHeroText(data.heroText || DEFAULT_HERO_TEXT)
          setHeroImage(data.heroImage || '')
          setTheme(data.theme === 'dark' ? 'dark' : 'light')
        }
      } catch {
        // Use defaults on error
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  async function handleImageUpload(file: File) {
    setUploading(true)
    setMessage(null)

    try {
      // Step 1: Get presigned URL
      const presignedRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: 'homepage',
          filename: file.name,
          contentType: file.type,
          size: file.size,
          folder: 'platform',
        }),
      })

      if (!presignedRes.ok) {
        throw new Error('Failed to get upload URL')
      }

      const { data } = await presignedRes.json()

      // Step 2: Upload directly to S3/MinIO
      const uploadRes = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error('Failed to upload image')
      }

      setHeroImage(data.publicUrl)
      setPreviewImage(null)
      setMessage({ type: 'success', text: 'Image uploaded successfully' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to upload image. Please try again.' })
    } finally {
      setUploading(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage({ type: 'error', text: 'Please select a JPEG, PNG, or WebP image.' })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be smaller than 10MB.' })
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onload = () => setPreviewImage(reader.result as string)
    reader.readAsDataURL(file)

    handleImageUpload(file)
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/admin/homepage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heroText: heroText.trim(),
          heroImage,
          theme,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save')
      }

      setMessage({ type: 'success', text: 'Settings saved successfully.' })
      window.dispatchEvent(new Event('customization-updated'))
      router.refresh()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save settings.',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const displayImage = previewImage || heroImage || '/hero-image.jpg'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Customization</h1>
        <p className="mt-1 text-sm text-gray-500">
          Customize the look and feel of your platform.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Live Preview */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-gray-700">Preview</h2>
        <div className="relative w-full overflow-hidden rounded-[20px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImage}
            alt="Hero preview"
            className="h-[160px] w-full object-cover sm:h-[220px] md:h-[280px]"
          />
          <div className="absolute left-4 right-4 top-[10%] rounded-[20px] border border-[rgba(255,255,255,0.31)] bg-[rgba(217,217,217,0.10)] px-4 py-3 backdrop-blur-[17.5px] sm:left-8 sm:right-auto sm:px-6 sm:py-4 md:left-10">
            <p
              className="text-lg font-bold leading-tight text-white sm:text-2xl md:text-3xl"
              style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
            >
              {heroText || DEFAULT_HERO_TEXT}
            </p>
          </div>
        </div>
      </div>

      {/* Hero Text */}
      <div>
        <label htmlFor="heroText" className="block text-sm font-medium text-gray-700">
          Hero Text
        </label>
        <p className="mt-1 text-xs text-gray-500">
          The main heading displayed over the hero image.
        </p>
        <input
          id="heroText"
          type="text"
          value={heroText}
          onChange={(e) => setHeroText(e.target.value)}
          placeholder={DEFAULT_HERO_TEXT}
          maxLength={200}
          className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#5C8BD9] focus:outline-none focus:ring-1 focus:ring-[#5C8BD9]"
        />
        <p className="mt-1 text-xs text-gray-400">{heroText.length}/200 characters</p>
      </div>

      {/* Hero Image */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Hero Image</label>
        <p className="mt-1 text-xs text-gray-500">
          Recommended: 1920×600px or wider. JPEG, PNG, or WebP. Max 10MB.
        </p>

        <div className="mt-3 flex items-start gap-4">
          {/* Current image thumbnail */}
          <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {displayImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displayImage}
                  alt="Current hero"
                  className="h-full w-full object-cover"
                />
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <ImageIcon className="h-8 w-8 text-gray-300" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload Image'}
            </button>

            {heroImage && (
              <button
                type="button"
                onClick={() => {
                  setHeroImage('')
                  setPreviewImage(null)
                }}
                className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
              >
                <X className="h-3 w-3" />
                Remove (use default)
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Theme */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Site Theme</label>
        <p className="mt-1 text-xs text-gray-500">
          Choose between a light or dark theme for the entire website.
        </p>
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex items-center gap-3 rounded-lg border-2 px-5 py-3 transition ${
              theme === 'light'
                ? 'border-[#5C8BD9] bg-blue-50 text-[#5C8BD9]'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
            }`}
          >
            <Sun className="h-5 w-5" />
            <div className="text-left">
              <p className="text-sm font-semibold">Light</p>
              <p className="text-xs opacity-70">Default theme</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-3 rounded-lg border-2 px-5 py-3 transition ${
              theme === 'dark'
                ? 'border-[#5C8BD9] bg-blue-50 text-[#5C8BD9]'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
            }`}
          >
            <Moon className="h-5 w-5" />
            <div className="text-left">
              <p className="text-sm font-semibold">Dark</p>
              <p className="text-xs opacity-70">Dark background</p>
            </div>
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4 border-t border-gray-200 pt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploading || !heroText.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-[#5C8BD9] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4a7ac8] disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>

        <button
          type="button"
          onClick={() => {
            setHeroText(DEFAULT_HERO_TEXT)
            setHeroImage('')
            setPreviewImage(null)
            setTheme('light')
          }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}
