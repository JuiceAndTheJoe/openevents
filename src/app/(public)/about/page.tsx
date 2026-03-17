export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-900">
          About OpenEvents
        </h1>

        {/* Main Description */}
        <section className="mb-12">
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            OpenEvents is a modern ticketing and event management platform
            designed to help organizers create, promote, and manage events with
            ease. Whether you're organizing a conference, workshop, webinar, or
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

        {/* Streaming Tech Section */}
        <section className="mb-12 p-8 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Streaming Tech Sweden 2026
          </h2>
          <p className="text-gray-700 mb-6">
            OpenEvents was originally created to manage ticketing for{' '}
            <a
              href="https://www.streamingtech.se/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-800 font-medium underline"
            >
              Streaming Tech Sweden
            </a>
            , the premier Nordic conference for video streaming and media technology professionals.
          </p>
          <a
            href="/events/streaming-tech-2026-5fa0c1d6"
            className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Get Tickets for Streaming Tech 2026 →
          </a>
        </section>

        {/* About Eyevinn */}
        <section className="mb-12 p-8 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            About Eyevinn Technology AB
          </h2>
          <p className="text-gray-700 mb-6">
            OpenEvents is operated by Eyevinn Technology AB, a Swedish
            technology company specializing in video technology and streaming
            solutions.
          </p>
          <p className="text-gray-700 mb-6">
            Learn more about our company and other services at:
          </p>
          <a
            href="https://www.eyevinntechnology.se/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Visit Eyevinn Technology →
          </a>
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
      </div>
    </main>
  );
}
