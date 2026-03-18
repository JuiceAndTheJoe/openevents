import { getContactContent } from '@/lib/legal-content'

export const dynamic = 'force-dynamic'

function DefaultContactContent() {
  return (
    <>
      <h1 className="text-4xl font-bold mb-2 text-gray-900">Contact Us</h1>
      <p className="text-gray-600 mb-12">
        Get in touch with us for support, inquiries, or partnerships.
      </p>

      <section className="p-8 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-600 text-center">
          Contact information has not been configured yet.
          <br />
          Please check back later or contact the event organizer directly.
        </p>
      </section>
    </>
  )
}

type CustomContactContentProps = {
  contact: {
    email: string
    phone: string
    companyName: string
    address: string
    businessHours: string
  }
}

function CustomContactContent({ contact }: CustomContactContentProps) {
  return (
    <>
      <h1 className="text-4xl font-bold mb-2 text-gray-900">Contact Us</h1>
      {contact.companyName && (
        <p className="text-gray-600 mb-12">
          Get in touch with {contact.companyName} for support, inquiries, or
          partnerships.
        </p>
      )}

      {contact.email && (
        <section className="mb-12 p-8 bg-blue-50 rounded-lg border-l-4 border-blue-500">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Email</h2>
          <a
            href={`mailto:${contact.email}`}
            className="text-blue-600 hover:text-blue-800 hover:underline text-lg"
          >
            {contact.email}
          </a>
        </section>
      )}

      {contact.phone && (
        <section className="mb-12 p-8 bg-green-50 rounded-lg border-l-4 border-green-500">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Phone</h2>
          <a
            href={`tel:${contact.phone.replace(/\s/g, '')}`}
            className="text-green-600 hover:text-green-800 hover:underline text-lg"
          >
            {contact.phone}
          </a>
        </section>
      )}

      {contact.address && (
        <section className="mb-12 p-8 bg-purple-50 rounded-lg border-l-4 border-purple-500">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Address</h2>
          <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-line">
            {contact.companyName && (
              <>
                {contact.companyName}
                <br />
              </>
            )}
            {contact.address}
          </p>
        </section>
      )}

      {contact.businessHours && (
        <section className="mt-12 p-8 bg-gray-50 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Business Hours
          </h2>
          <p className="text-gray-700 whitespace-pre-line">
            {contact.businessHours}
          </p>
        </section>
      )}
    </>
  )
}

export default async function ContactPage() {
  const customContent = await getContactContent()

  const hasCustomContent =
    customContent &&
    (customContent.email ||
      customContent.phone ||
      customContent.companyName ||
      customContent.address ||
      customContent.businessHours)

  return (
    <main className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {hasCustomContent ? (
          <CustomContactContent contact={customContent} />
        ) : (
          <DefaultContactContent />
        )}
      </div>
    </main>
  )
}
