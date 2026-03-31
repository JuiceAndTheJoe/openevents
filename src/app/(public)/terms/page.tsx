import { getLegalContent } from '@/lib/legal-content'

export const dynamic = 'force-dynamic'

function DefaultTermsContent() {
  return (
    <>
      {/* TERMS OF SERVICE SECTION */}
      <div className="mb-16">
        <h1 className="text-4xl font-bold mb-2 text-gray-900">
          Terms of Service
        </h1>
        <p className="text-gray-600 mb-8">Last updated: March 2026</p>

        <p className="text-gray-700 mb-8">
          These Terms of Service (&quot;Terms&quot;) govern your use of this
          OpenEvents instance and the purchase of tickets for events managed
          through this platform. By purchasing a ticket or using the platform,
          you agree to these Terms.
        </p>

        {/* Section 1 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            1. About OpenEvents
          </h2>
          <p className="text-gray-700">
            OpenEvents is an open-source ticketing platform. This instance is
            operated by the organization indicated in the event details. The
            operator is responsible for managing events and ticket sales
            through this platform.
          </p>
        </section>

        {/* Section 2 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            2. Ticket Purchase
          </h2>
          <p className="text-gray-700 mb-4">When purchasing a ticket:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
            <li>You agree to provide accurate information</li>
            <li>
              You confirm you are legally capable of entering into a contract
            </li>
            <li>A binding agreement is formed upon payment confirmation</li>
            <li>
              All prices are stated in SEK/EUR and include VAT where
              applicable
            </li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            3. Event Changes
          </h2>
          <p className="text-gray-700 mb-4">
            The event organizer reserves the right to:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
            <li>Modify the event program</li>
            <li>Change speakers</li>
            <li>Change venue</li>
            <li>Change event date</li>
          </ul>
          <p className="text-gray-700">
            Such changes do not automatically entitle the participant to a
            refund unless explicitly stated.
          </p>
        </section>

        {/* Section 4 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            4. Event Cancellation
          </h2>
          <p className="text-gray-700">
            If the event is canceled entirely by the organizer, ticket holders
            are entitled to a refund according to the Refund Policy.
          </p>
        </section>

        {/* Section 5 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            5. Transfer of Tickets
          </h2>
          <p className="text-gray-700">
            Tickets may be transferable unless otherwise stated. The ticket
            holder is responsible for ensuring correct attendee information.
          </p>
        </section>

        {/* Section 6 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            6. Limitation of Liability
          </h2>
          <p className="text-gray-700 mb-4">
            To the extent permitted by applicable law:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
            <li>The operator is not liable for indirect damages</li>
            <li>Liability is limited to the ticket price paid</li>
            <li>
              Nothing limits liability where prohibited by applicable law
            </li>
          </ul>
        </section>

        {/* Section 7 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            7. Force Majeure
          </h2>
          <p className="text-gray-700 mb-4">
            The operator is not liable for failure to perform due to
            circumstances beyond reasonable control, including but not limited
            to:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Natural disasters</li>
            <li>Government restrictions</li>
            <li>Labor disputes</li>
            <li>Technical failures</li>
          </ul>
        </section>

        {/* Section 8 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            8. Intellectual Property
          </h2>
          <p className="text-gray-700 mb-4">
            All content related to the event, including branding, materials,
            and media, is owned by the event organizer unless otherwise
            stated.
          </p>
          <p className="text-gray-700">
            Recording, redistribution, or commercial use of event content is
            prohibited without permission.
          </p>
        </section>

        {/* Section 9 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            9. Governing Law
          </h2>
          <p className="text-gray-700 mb-4">
            These Terms are governed by the laws applicable to the
            operator&apos;s jurisdiction.
          </p>
          <p className="text-gray-700">
            Any disputes shall be resolved in accordance with applicable law.
          </p>
        </section>

        {/* Section 10 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            10. Contact
          </h2>
          <p className="text-gray-700">
            For questions regarding these Terms, please contact the operator
            of this OpenEvents instance through the contact information
            provided on the event page.
          </p>
        </section>
      </div>

      {/* REFUND POLICY SECTION */}
      <div className="border-t-2 border-gray-200 pt-16">
        <h1 className="text-4xl font-bold mb-2 text-gray-900">
          Cancellation & Refund Policy
        </h1>
        <p className="text-gray-600 mb-8">Last updated: March 2026</p>

        <p className="text-gray-700 mb-12">
          This policy applies to ticket purchases made via OpenEvents.
        </p>

        {/* Refund Section 1 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            1. Participant Cancellation
          </h2>
          <div className="space-y-4">
            <div className="border-l-4 border-green-500 pl-4 py-2">
              <p className="font-semibold text-gray-900">
                More than 30 days before the event
              </p>
              <p className="text-gray-700">
                Full refund minus administrative fee (if applicable)
              </p>
            </div>
            <div className="border-l-4 border-yellow-500 pl-4 py-2">
              <p className="font-semibold text-gray-900">
                14–30 days before the event
              </p>
              <p className="text-gray-700">50% refund</p>
            </div>
            <div className="border-l-4 border-red-500 pl-4 py-2">
              <p className="font-semibold text-gray-900">
                Less than 14 days before the event
              </p>
              <p className="text-gray-700">No refund</p>
            </div>
          </div>
        </section>

        {/* Refund Section 2 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            2. Ticket Transfer
          </h2>
          <p className="text-gray-700">
            Tickets may be transferred to another participant free of charge
            up until 48 hours before the event.
          </p>
        </section>

        {/* Refund Section 3 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            3. Event Cancellation by Organizer
          </h2>
          <p className="text-gray-700 mb-4">
            If the event is fully canceled:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Full refund of ticket price</li>
            <li>No compensation for travel, accommodation, or other costs</li>
          </ul>
        </section>

        {/* Refund Section 4 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            4. Event Postponement
          </h2>
          <p className="text-gray-700 mb-4">If the event is postponed:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
            <li>Tickets remain valid for the new date</li>
            <li>
              Refund may be requested within 14 days of postponement
              announcement
            </li>
          </ul>
        </section>

        {/* Refund Section 5 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            5. Refund Processing
          </h2>
          <p className="text-gray-700">
            Refunds are processed using the original payment method within
            14–30 days.
          </p>
        </section>
      </div>
    </>
  )
}

export default async function TermsPage() {
  const customContent = await getLegalContent('legal_tos')

  return (
    <main className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {customContent?.plainText?.trim() ? (
          <div>
            <h1 className="text-4xl font-bold mb-8 text-gray-900">Terms of Service</h1>
            <div
              className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-a:text-[#5C8BD9] prose-a:hover:text-[#4a7ac8]"
              dangerouslySetInnerHTML={{ __html: customContent.html }}
            />
          </div>
        ) : (
          <DefaultTermsContent />
        )}
      </div>
    </main>
  )
}
