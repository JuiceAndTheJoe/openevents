import { redirect } from 'next/navigation'
import { getLegalContent } from '@/lib/legal-content'

export const dynamic = 'force-dynamic'

export default async function AboutPage() {
  const customContent = await getLegalContent('legal_about')

  if (!customContent?.plainText?.trim()) {
    redirect('/about/openevents')
  }

  return (
    <main className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-900">About Us</h1>
        <div
          className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-a:text-[#5C8BD9] prose-a:hover:text-[#4a7ac8]"
          dangerouslySetInnerHTML={{ __html: customContent.html }}
        />

        {/* OpenEvents attribution */}
        <div className="mt-12 rounded-lg border border-gray-200 bg-gray-50 p-6">
          <p className="text-sm text-gray-600">
            Powered by{' '}
            <a
              href="/about/openevents"
              className="text-[#5C8BD9] hover:text-[#4a7ac8] font-medium"
            >
              OpenEvents
            </a>
            {' '}— an open-source event management and ticketing platform.
          </p>
        </div>
      </div>
    </main>
  )
}
