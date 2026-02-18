import Link from "next/link"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/db"
import { EventList } from "@/components/events/EventList"

export default async function Home() {
  const featuredEvents = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      visibility: "PUBLIC",
    },
    include: {
      organizer: {
        select: {
          orgName: true,
        },
      },
      ticketTypes: {
        where: {
          isVisible: true,
        },
        select: {
          price: true,
          currency: true,
        },
      },
    },
    orderBy: [
      { publishedAt: "desc" },
      { startDate: "asc" },
    ],
    take: 6,
  })

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Create Memorable Events :)
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-blue-100">
              An open-source event management platform. Create events, sell tickets,
              and connect with your audience seamlessly.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/events">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 w-full sm:w-auto">
                  Browse Events
                </Button>
              </Link>
              <Link href="/create-event">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 w-full sm:w-auto">
                  Start Organizing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Latest Published Events</h2>
              <p className="mt-2 text-gray-600">Newly published events appear here automatically.</p>
            </div>
            <Link href="/events">
              <Button variant="outline">View All Events</Button>
            </Link>
          </div>
          <EventList events={featuredEvents} />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              Everything You Need to Run Events
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Powerful features for organizers and attendees alike
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Feature 1 */}
            <div className="text-center p-6">
              <div className="mx-auto h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">
                Easy Event Creation
              </h3>
              <p className="mt-2 text-gray-600">
                Create beautiful event pages with all the details your attendees need.
                Add agendas, speakers, and media.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center p-6">
              <div className="mx-auto h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">
                Flexible Ticketing
              </h3>
              <p className="mt-2 text-gray-600">
                Multiple ticket types, discount codes, and capacity management.
                Accept payments or offer free tickets.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center p-6">
              <div className="mx-auto h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">
                Powerful Analytics
              </h3>
              <p className="mt-2 text-gray-600">
                Track ticket sales, revenue, and attendee information.
                Make data-driven decisions for your events.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="bg-blue-600 rounded-2xl px-8 py-16 text-center">
            <h2 className="text-3xl font-bold text-white">
              Ready to Create Your Event?
            </h2>
            <p className="mt-4 text-lg text-blue-100">
              Join thousands of organizers who trust OpenEvents for their events.
            </p>
              <Link href="/create-event" className="mt-8 inline-block">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50">
                  Get Started for Free
                </Button>
              </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Get your event up and running in minutes
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-4">
            {[
              { step: "1", title: "Create Account", desc: "Sign up as an organizer in seconds" },
              { step: "2", title: "Add Event Details", desc: "Fill in your event information" },
              { step: "3", title: "Set Up Tickets", desc: "Configure ticket types and pricing" },
              { step: "4", title: "Start Selling", desc: "Publish and share with your audience" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
