type EventHeroProps = {
  title: string
  description: string | null
  coverImage: string | null
  startDate: Date
}

export function EventHero({ title, description, coverImage, startDate }: EventHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-blue-900 p-8 text-white md:p-12">
      {coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverImage}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
      ) : null}
      <div className="relative max-w-3xl">
        <p className="mb-3 text-sm uppercase tracking-widest text-blue-100">
          {new Date(startDate).toLocaleDateString()}
        </p>
        <h1 className="text-4xl font-bold md:text-5xl">{title}</h1>
        {description ? <p className="mt-4 text-lg text-blue-100">{description}</p> : null}
      </div>
    </section>
  )
}
