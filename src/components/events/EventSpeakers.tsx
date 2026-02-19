type Speaker = {
  id: string
  name: string
  title: string | null
  bio: string | null
  photo: string | null
}

type EventSpeakersProps = {
  speakers: Speaker[]
}

export function EventSpeakers({ speakers }: EventSpeakersProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-gray-900">Speakers</h2>
      {speakers.length === 0 ? (
        <p className="mt-3 text-sm text-gray-600">Speaker details will be announced soon.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {speakers.map((speaker) => (
            <article key={speaker.id} className="rounded-lg border border-gray-100 p-4">
              <div className="flex items-start gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-full bg-gray-100">
                  {speaker.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={speaker.photo} alt={speaker.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{speaker.name}</h3>
                  {speaker.title ? <p className="text-sm text-blue-700">{speaker.title}</p> : null}
                </div>
              </div>
              {speaker.bio ? <p className="mt-3 text-sm text-gray-700">{speaker.bio}</p> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
