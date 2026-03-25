'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ImageIcon, Upload, X, Loader2, Sun, Moon, LayoutGrid, Layers, GalleryHorizontal } from 'lucide-react'

type FooterLink = { label: string; href: string; external?: boolean }

const DEFAULT_FOOTER_LINKS: FooterLink[] = [
  { label: 'About Us', href: '/about' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
]

const DEFAULTS = {
  heroText: 'Events made for business',
  heroImage: '',
  theme: 'light' as const,
  platformName: 'OpenEvents',
  platformLogo: '',
  platformFavicon: '',
  brandColor: '#5C8BD9',
  footerTagline: 'Organizing events starts here',
}

export default function AdminCustomizationPage() {
  const router = useRouter()
  const heroFileInputRef = useRef<HTMLInputElement>(null)
  const logoFileInputRef = useRef<HTMLInputElement>(null)
  const faviconFileInputRef = useRef<HTMLInputElement>(null)

  const [heroText, setHeroText] = useState(DEFAULTS.heroText)
  const [heroImage, setHeroImage] = useState('')
  const [eventLayout, setEventLayout] = useState<'showcase' | 'grid' | 'carousel'>('showcase')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [platformName, setPlatformName] = useState(DEFAULTS.platformName)
  const [platformLogo, setPlatformLogo] = useState('')
  const [platformFavicon, setPlatformFavicon] = useState('')
  const [brandColor, setBrandColor] = useState(DEFAULTS.brandColor)
  const [footerTagline, setFooterTagline] = useState(DEFAULTS.footerTagline)
  const [footerLinks, setFooterLinks] = useState<FooterLink[]>(DEFAULT_FOOTER_LINKS)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/admin/homepage')
        if (res.ok) {
          const { data } = await res.json()
          setHeroText(data.heroText || DEFAULTS.heroText)
          setHeroImage(data.heroImage || '')
          if (data.eventLayout === 'grid' || data.eventLayout === 'carousel') {
            setEventLayout(data.eventLayout)
          }
          setTheme(data.theme === 'dark' ? 'dark' : 'light')
          setPlatformName(data.platformName || DEFAULTS.platformName)
          setPlatformLogo(data.platformLogo || '')
          setPlatformFavicon(data.platformFavicon || '')
          setBrandColor(data.brandColor || DEFAULTS.brandColor)
          setFooterTagline(data.footerTagline ?? DEFAULTS.footerTagline)
          if (data.footerLinks && Array.isArray(data.footerLinks)) {
            // Ensure defaults are always present at the start, then append custom links
            const defaultHrefs = new Set(DEFAULT_FOOTER_LINKS.map(l => l.href))
            const customLinks = data.footerLinks.filter((l: FooterLink) => !defaultHrefs.has(l.href))
            setFooterLinks([...DEFAULT_FOOTER_LINKS, ...customLinks])
          }
        }
      } catch {
        // Use defaults on error
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  async function uploadFile(file: File, entityId: string, onSuccess: (url: string) => void) {
    const uploadKey = entityId
    setUploading(uploadKey)
    setMessage(null)

    try {
      const presignedRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
          folder: 'platform',
        }),
      })

      if (!presignedRes.ok) throw new Error('Failed to get upload URL')

      const { data } = await presignedRes.json()

      const uploadRes = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!uploadRes.ok) throw new Error('Failed to upload file')

      onSuccess(data.publicUrl)
      setMessage({ type: 'success', text: 'File uploaded successfully' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to upload file. Please try again.' })
    } finally {
      setUploading(null)
    }
  }

  function handleFileSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    entityId: string,
    onSuccess: (url: string) => void,
    opts?: { maxSize?: number; allowSvg?: boolean }
  ) {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (opts?.allowSvg) validTypes.push('image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon')

    if (!validTypes.includes(file.type)) {
      setMessage({ type: 'error', text: `Please select a valid image file.` })
      return
    }

    const maxSize = opts?.maxSize ?? 10 * 1024 * 1024
    if (file.size > maxSize) {
      setMessage({ type: 'error', text: `File must be smaller than ${Math.round(maxSize / 1024 / 1024)}MB.` })
      return
    }

    const reader = new FileReader()
    reader.onload = () => setPreviews((prev) => ({ ...prev, [entityId]: reader.result as string }))
    reader.readAsDataURL(file)

    uploadFile(file, entityId, onSuccess)
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
          eventLayout,
          theme,
          platformName: platformName.trim(),
          platformLogo,
          platformFavicon,
          brandColor,
          footerTagline,
          footerLinks: footerLinks.filter(l => l.label.trim() && l.href.trim()),
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

  const displayImage = previews['homepage'] || (heroImage ? '/api/platform/image/hero' : '/hero-image.jpg')

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Customization</h1>
        <p className="mt-1 text-sm text-gray-500">
          Customize the branding and look of your platform.
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

      {/* ================================================================
          BRANDING SECTION
          ================================================================ */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Branding</h2>

        {/* Platform Name */}
        <div>
          <label htmlFor="platformName" className="block text-sm font-medium text-gray-700">
            Platform Name
          </label>
          <p className="mt-1 text-xs text-gray-500">
            Displayed in the header, footer, browser tab, and metadata.
          </p>
          <input
            id="platformName"
            type="text"
            value={platformName}
            onChange={(e) => setPlatformName(e.target.value)}
            placeholder={DEFAULTS.platformName}
            maxLength={100}
            className="mt-2 block w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#5C8BD9] focus:outline-none focus:ring-1 focus:ring-[#5C8BD9]"
          />
        </div>

        {/* Brand Color */}
        <div>
          <label htmlFor="brandColor" className="block text-sm font-medium text-gray-700">
            Brand Color
          </label>
          <p className="mt-1 text-xs text-gray-500">
            Accent color used for buttons, links, and active states across the site.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <input
              id="brandColor"
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-gray-300 p-1"
            />
            <input
              type="text"
              value={brandColor}
              onChange={(e) => {
                const val = e.target.value
                if (/^#[0-9a-fA-F]{0,6}$/.test(val)) setBrandColor(val)
              }}
              maxLength={7}
              className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono shadow-sm focus:border-[#5C8BD9] focus:outline-none focus:ring-1 focus:ring-[#5C8BD9]"
            />
            {brandColor !== DEFAULTS.brandColor && (
              <button
                type="button"
                onClick={() => setBrandColor(DEFAULTS.brandColor)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Reset
              </button>
            )}
          </div>
          {/* Color preview */}
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-gray-500">Preview:</span>
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: brandColor }}
              disabled
            >
              Sample Button
            </button>
            <span className="text-sm font-medium" style={{ color: brandColor }}>Sample Link</span>
          </div>
        </div>

        {/* Logo */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Logo</label>
          <p className="mt-1 text-xs text-gray-500">
            Replaces the platform name text in the header. Recommended: SVG or PNG with transparent background, max height 36px.
          </p>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-12 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 px-2">
              {(previews['logo'] || platformLogo) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews['logo'] || '/api/platform/image/logo'} alt="Logo" className="h-full w-auto object-contain" />
              ) : (
                <span className="text-xs text-gray-400">No logo</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => logoFileInputRef.current?.click()}
                disabled={uploading === 'logo'}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {uploading === 'logo' ? 'Uploading...' : 'Upload Logo'}
              </button>
              {platformLogo && (
                <button type="button" onClick={() => setPlatformLogo('')} className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700">
                  <X className="h-3 w-3" /> Remove
                </button>
              )}
            </div>
            <input ref={logoFileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={(e) => handleFileSelect(e, 'logo', setPlatformLogo)} className="hidden" />
          </div>
        </div>

        {/* Favicon */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Favicon</label>
          <p className="mt-1 text-xs text-gray-500">
            The small icon shown in the browser tab. Recommended: 32×32px or 64×64px PNG, ICO, or SVG.
          </p>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {(previews['favicon'] || platformFavicon) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews['favicon'] || '/api/platform/image/favicon'} alt="Favicon" className="h-6 w-6 object-contain" />
              ) : (
                <ImageIcon className="h-4 w-4 text-gray-300" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => faviconFileInputRef.current?.click()}
                disabled={uploading === 'favicon'}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {uploading === 'favicon' ? 'Uploading...' : 'Upload Favicon'}
              </button>
              {platformFavicon && (
                <button type="button" onClick={() => setPlatformFavicon('')} className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700">
                  <X className="h-3 w-3" /> Remove
                </button>
              )}
            </div>
            <input ref={faviconFileInputRef} type="file" accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon" onChange={(e) => handleFileSelect(e, 'favicon', setPlatformFavicon, { maxSize: 1024 * 1024, allowSvg: true })} className="hidden" />
          </div>
        </div>
      </div>

      {/* ================================================================
          HOMEPAGE SECTION
          ================================================================ */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Homepage</h2>

        {/* Live Preview */}
        <div>
          <label className="mb-3 block text-sm font-medium text-gray-700">Preview</label>
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
                {heroText || DEFAULTS.heroText}
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
            placeholder={DEFAULTS.heroText}
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
            <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {displayImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={displayImage} alt="Current hero" className="h-full w-full object-cover" />
                  {uploading === 'homepage' && (
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
                onClick={() => heroFileInputRef.current?.click()}
                disabled={uploading === 'homepage'}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {uploading === 'homepage' ? 'Uploading...' : 'Upload Image'}
              </button>
              {heroImage && (
                <button type="button" onClick={() => { setHeroImage(''); setPreviews((prev) => { const next = { ...prev }; delete next['homepage']; return next }) }} className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700">
                  <X className="h-3 w-3" /> Remove (use default)
                </button>
              )}
            </div>
            <input ref={heroFileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleFileSelect(e, 'homepage', setHeroImage)} className="hidden" />
          </div>
        </div>

        {/* Event Layout */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Event Display Layout</label>
          <p className="mt-1 text-xs text-gray-500">
            Choose how events are displayed on the homepage.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { value: 'showcase' as const, icon: Layers, label: 'Showcase', desc: 'Featured hero card with grid below' },
              { value: 'grid' as const, icon: LayoutGrid, label: 'Grid', desc: 'Equal-sized cards in a uniform grid' },
              { value: 'carousel' as const, icon: GalleryHorizontal, label: 'Carousel', desc: 'Swipeable full-width slideshow' },
            ]).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setEventLayout(option.value)}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 px-4 py-4 transition text-center ${
                  eventLayout === option.value
                    ? 'border-[#5C8BD9] bg-blue-50 text-[#5C8BD9]'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <option.icon className="h-6 w-6" />
                <div>
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{option.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ================================================================
          FOOTER SECTION
          ================================================================ */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Footer</h2>

        {/* Tagline */}
        <div>
          <label htmlFor="footerTagline" className="block text-sm font-medium text-gray-700">
            Tagline
          </label>
          <p className="mt-1 text-xs text-gray-500">
            Short text displayed below the platform name in the footer. Leave empty to hide.
          </p>
          <input
            id="footerTagline"
            type="text"
            value={footerTagline}
            onChange={(e) => setFooterTagline(e.target.value)}
            placeholder={DEFAULTS.footerTagline}
            maxLength={200}
            className="mt-2 block w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#5C8BD9] focus:outline-none focus:ring-1 focus:ring-[#5C8BD9]"
          />
        </div>

        {/* Footer Links */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Footer Links</label>
          <p className="mt-1 text-xs text-gray-500">
            The default links are required and cannot be removed. You can add up to 3 additional links.
          </p>
          <div className="mt-3 space-y-3">
            {/* Default links — read-only, not removable */}
            {DEFAULT_FOOTER_LINKS.map((link) => (
              <div key={link.href} className="flex items-center gap-2">
                <input
                  type="text"
                  value={link.label}
                  disabled
                  className="w-40 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                />
                <input
                  type="text"
                  value={link.href}
                  disabled
                  className="flex-1 max-w-sm rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                />
                <span className="w-[72px]" />
                <span className="w-6" />
              </div>
            ))}

            {/* Custom links — editable and removable */}
            {footerLinks.slice(DEFAULT_FOOTER_LINKS.length).map((link, i) => {
              const index = DEFAULT_FOOTER_LINKS.length + i
              return (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={link.label}
                    onChange={(e) => {
                      const updated = [...footerLinks]
                      updated[index] = { ...updated[index], label: e.target.value }
                      setFooterLinks(updated)
                    }}
                    placeholder="Label"
                    className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#5C8BD9] focus:outline-none focus:ring-1 focus:ring-[#5C8BD9]"
                  />
                  <input
                    type="text"
                    value={link.href}
                    onChange={(e) => {
                      const updated = [...footerLinks]
                      updated[index] = { ...updated[index], href: e.target.value }
                      setFooterLinks(updated)
                    }}
                    placeholder="/page or https://..."
                    className="flex-1 max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#5C8BD9] focus:outline-none focus:ring-1 focus:ring-[#5C8BD9]"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={link.external ?? false}
                      onChange={(e) => {
                        const updated = [...footerLinks]
                        updated[index] = { ...updated[index], external: e.target.checked }
                        setFooterLinks(updated)
                      }}
                      className="rounded border-gray-300"
                    />
                    External
                  </label>
                  <button
                    type="button"
                    onClick={() => setFooterLinks(footerLinks.filter((_, idx) => idx !== index))}
                    className="rounded p-1 text-gray-400 hover:text-red-600 transition"
                    aria-label="Remove link"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )
            })}

            {footerLinks.length < DEFAULT_FOOTER_LINKS.length + 3 && (
              <button
                type="button"
                onClick={() => setFooterLinks([...footerLinks, { label: '', href: '', external: false }])}
                className="text-sm font-medium text-[#5C8BD9] hover:text-[#4a7ac8]"
              >
                + Add link ({3 - (footerLinks.length - DEFAULT_FOOTER_LINKS.length)} remaining)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================
          APPEARANCE SECTION
          ================================================================ */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Appearance</h2>

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
      </div>

      {/* ================================================================
          SAVE
          ================================================================ */}
      <div className="flex items-center gap-4 border-t border-gray-200 pt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !!uploading || !heroText.trim() || !platformName.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-[#5C8BD9] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4a7ac8] disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>

        <button
          type="button"
          onClick={() => {
            setHeroText(DEFAULTS.heroText)
            setHeroImage('')
            setPreviews({})
            setEventLayout('showcase')
            setTheme('light')
            setPlatformName(DEFAULTS.platformName)
            setPlatformLogo('')
            setPlatformFavicon('')
            setBrandColor(DEFAULTS.brandColor)
            setFooterTagline(DEFAULTS.footerTagline)
            setFooterLinks(DEFAULT_FOOTER_LINKS)
          }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}
