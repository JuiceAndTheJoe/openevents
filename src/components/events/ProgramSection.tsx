import { AgendaEditor } from '@/components/events/AgendaEditor'
import { SpeakerEditor } from '@/components/events/SpeakerEditor'

type Speaker = {
  id: string
  name: string
  title: string | null
  bio: string | null
  photo: string | null
  sortOrder: number
}

type AgendaItem = {
  id: string
  title: string
  description: string | null
  startTime: string | Date
  endTime: string | Date | null
  speakerId: string | null
  sortOrder: number
}

type ProgramSectionProps = {
  eventId: string
  speakers: Speaker[]
  agendaItems: AgendaItem[]
}

export function ProgramSection({ eventId, speakers, agendaItems }: ProgramSectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold text-gray-900">Program Workspace</h4>
      <p className="text-sm text-gray-600">Add speakers first, then assign them while building the agenda.</p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SpeakerEditor
          eventId={eventId}
          initialSpeakers={speakers}
        />
        <AgendaEditor
          eventId={eventId}
          speakers={speakers.map((speaker) => ({ id: speaker.id, name: speaker.name }))}
          initialItems={agendaItems}
        />
      </div>
    </div>
  )
}
