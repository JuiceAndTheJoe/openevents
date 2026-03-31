'use client'

import { useState } from 'react'
import { RichTextEditor } from '@/components/ui/rich-text-editor'

type LegalContent = {
  html: string
  plainText: string
  updatedAt?: string
}

type ContactContent = {
  email: string
  phone: string
  companyName: string
  address: string
  businessHours: string
  updatedAt?: string
}

type Tab = 'tos' | 'about' | 'privacy' | 'contact'

type LegalContactFormProps = {
  initialData: {
    tos: LegalContent | null
    about: LegalContent | null
    privacy: LegalContent | null
    contact: ContactContent | null
  }
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'about', label: 'About Us' },
  { id: 'contact', label: 'Contact' },
  { id: 'privacy', label: 'Privacy Policy' },
  { id: 'tos', label: 'Terms of Service' },
]

export function LegalContactForm({ initialData }: LegalContactFormProps) {
  const [activeTab, setActiveTab] = useState<Tab>('about')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [tosContent, setTosContent] = useState<LegalContent>(
    initialData.tos || { html: '', plainText: '' }
  )
  const [aboutContent, setAboutContent] = useState<LegalContent>(
    initialData.about || { html: '', plainText: '' }
  )
  const [privacyContent, setPrivacyContent] = useState<LegalContent>(
    initialData.privacy || { html: '', plainText: '' }
  )
  const [contactContent, setContactContent] = useState<ContactContent>(
    initialData.contact || {
      email: '',
      phone: '',
      companyName: '',
      address: '',
      businessHours: '',
    }
  )

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/legal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tos: tosContent,
          about: aboutContent,
          privacy: privacyContent,
          contact: contactContent,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save')
      }

      setMessage({ type: 'success', text: 'Content saved successfully.' })
      window.dispatchEvent(new CustomEvent('legal-content-updated'))
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save content.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'border-[#5C8BD9] text-[#5C8BD9]'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        {activeTab === 'tos' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Terms of Service</h3>
              <p className="mt-1 text-sm text-gray-500">
                Customize the Terms of Service page. Leave empty to use the default content.
              </p>
            </div>
            <RichTextEditor
              value={tosContent.html}
              onChange={(html, plainText) => setTosContent({ html, plainText })}
              placeholder="Enter your custom Terms of Service..."
            />
            {initialData.tos?.updatedAt && (
              <p className="text-xs text-gray-400">
                Last updated: {new Date(initialData.tos.updatedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {activeTab === 'about' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">About Us</h3>
              <p className="mt-1 text-sm text-gray-500">
                Customize the About Us page. Leave empty to use the default content.
              </p>
            </div>
            <RichTextEditor
              value={aboutContent.html}
              onChange={(html, plainText) => setAboutContent({ html, plainText })}
              placeholder="Enter your custom About Us content..."
            />
            {initialData.about?.updatedAt && (
              <p className="text-xs text-gray-400">
                Last updated: {new Date(initialData.about.updatedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Privacy Policy</h3>
              <p className="mt-1 text-sm text-gray-500">
                Customize the Privacy Policy page. Leave empty to use the default content.
              </p>
            </div>
            <RichTextEditor
              value={privacyContent.html}
              onChange={(html, plainText) => setPrivacyContent({ html, plainText })}
              placeholder="Enter your custom Privacy Policy..."
            />
            {initialData.privacy?.updatedAt && (
              <p className="text-xs text-gray-400">
                Last updated: {new Date(initialData.privacy.updatedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Contact Information</h3>
              <p className="mt-1 text-sm text-gray-500">
                Customize the Contact page. Leave empty to use the default content.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                  Company Name
                </label>
                <input
                  id="companyName"
                  type="text"
                  value={contactContent.companyName}
                  onChange={(e) =>
                    setContactContent({ ...contactContent, companyName: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#5C8BD9] focus:outline-none focus:ring-1 focus:ring-[#5C8BD9]"
                  placeholder="Your Company Name"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={contactContent.email}
                  onChange={(e) => setContactContent({ ...contactContent, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#5C8BD9] focus:outline-none focus:ring-1 focus:ring-[#5C8BD9]"
                  placeholder="contact@example.com"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={contactContent.phone}
                  onChange={(e) => setContactContent({ ...contactContent, phone: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#5C8BD9] focus:outline-none focus:ring-1 focus:ring-[#5C8BD9]"
                  placeholder="+1 234 567 890"
                />
              </div>
              <div>
                <label htmlFor="businessHours" className="block text-sm font-medium text-gray-700">
                  Business Hours
                </label>
                <input
                  id="businessHours"
                  type="text"
                  value={contactContent.businessHours}
                  onChange={(e) =>
                    setContactContent({ ...contactContent, businessHours: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#5C8BD9] focus:outline-none focus:ring-1 focus:ring-[#5C8BD9]"
                  placeholder="Mon-Fri 9:00-17:00"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Address
                </label>
                <textarea
                  id="address"
                  value={contactContent.address}
                  onChange={(e) =>
                    setContactContent({ ...contactContent, address: e.target.value })
                  }
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#5C8BD9] focus:outline-none focus:ring-1 focus:ring-[#5C8BD9]"
                  placeholder="123 Main Street&#10;City, Country&#10;12345"
                />
              </div>
            </div>
            {initialData.contact?.updatedAt && (
              <p className="text-xs text-gray-400">
                Last updated: {new Date(initialData.contact.updatedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Save Button and Message */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-[#5C8BD9] px-6 py-2 text-sm font-medium text-white transition hover:bg-[#4a7ac8] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
        {message && (
          <p
            className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
