import { getLegalContent } from '@/lib/legal-content'

export const dynamic = 'force-dynamic'

function DefaultAboutContent() {
  return (
    <>
      <h1 className="text-4xl font-bold mb-8 text-gray-900">
        About OpenEvents
      </h1>

      {/* Main Description */}
      <section className="mb-12">
        <p className="text-lg text-gray-700 leading-relaxed mb-6">
          OpenEvents is a modern ticketing and event management platform
          designed to help organizers create, promote, and manage events with
          ease. Whether you&apos;re organizing a conference, workshop, webinar, or
          community gathering, OpenEvents provides the tools you need to sell
          tickets, manage attendees, and deliver a seamless experience.
        </p>
        <p className="text-lg text-gray-700 leading-relaxed">
          Built with event organizers in mind, OpenEvents streamlines the
          entire event lifecycle—from ticket sales and attendee management to
          order tracking and reporting. Our platform is secure, reliable, and
          designed to scale with your event.
        </p>
      </section>

      {/* Open Source */}
      <section className="mb-12 p-8 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Open Source</h2>
        <p className="text-gray-700 mb-6">
          OpenEvents is open-source software, available for anyone to deploy
          and customize. Each OpenEvents instance is independently operated by
          its respective organization.
        </p>
        <p className="text-gray-700">
          For information about the operator of this instance, please refer to
          the event details or contact information provided.
        </p>
      </section>

      {/* Key Features */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Why Choose OpenEvents?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border-l-4 border-blue-500 bg-blue-50">
            <h3 className="font-semibold text-gray-900 mb-2">Easy to Use</h3>
            <p className="text-gray-700">
              Intuitive interface for creating and managing events without
              technical expertise.
            </p>
          </div>
          <div className="p-6 border-l-4 border-green-500 bg-green-50">
            <h3 className="font-semibold text-gray-900 mb-2">
              Secure Payments
            </h3>
            <p className="text-gray-700">
              Process payments safely with industry-standard security and
              compliance measures.
            </p>
          </div>
          <div className="p-6 border-l-4 border-purple-500 bg-purple-50">
            <h3 className="font-semibold text-gray-900 mb-2">
              Analytics & Insights
            </h3>
            <p className="text-gray-700">
              Track sales, attendee data, and event performance with detailed
              reports.
            </p>
          </div>
          <div className="p-6 border-l-4 border-orange-500 bg-orange-50">
            <h3 className="font-semibold text-gray-900 mb-2">
              Attendee Management
            </h3>
            <p className="text-gray-700">
              Manage registrations, check-ins, and communicate with attendees
              seamlessly.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}

export default async function AboutPage() {
  const customContent = await getLegalContent('legal_about')

  return (
    <main className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {customContent?.plainText?.trim() ? (
          <div>
            <h1 className="text-4xl font-bold mb-8 text-gray-900">About Us</h1>
            <div
              className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-a:text-[#5C8BD9] prose-a:hover:text-[#4a7ac8]"
              dangerouslySetInnerHTML={{ __html: customContent.html }}
            />
          </div>
        ) : (
          <DefaultAboutContent />
        )}
      </div>
    </main>
  )
}
