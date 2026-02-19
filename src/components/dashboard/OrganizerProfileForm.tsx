import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type OrganizerProfileFormProps = {
  initial: {
    orgName: string
    description: string | null
    logo: string | null
    website: string | null
    socialLinks: Record<string, string>
  }
  action: (formData: FormData) => Promise<void>
}

export function OrganizerProfileForm({ initial, action }: OrganizerProfileFormProps) {
  return (
    <form action={action} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      <h1 className="text-2xl font-bold text-gray-900">Organizer Profile</h1>

      <div>
        <Label htmlFor="orgName" required>Organization Name</Label>
        <Input id="orgName" name="orgName" defaultValue={initial.orgName} required />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          defaultValue={initial.description || ''}
          className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="website">Website</Label>
          <Input id="website" name="website" defaultValue={initial.website || ''} />
        </div>
        <div>
          <Label htmlFor="logo">Logo URL</Label>
          <Input id="logo" name="logo" defaultValue={initial.logo || ''} />
        </div>
        <div>
          <Label htmlFor="twitter">Twitter</Label>
          <Input id="twitter" name="twitter" defaultValue={initial.socialLinks.twitter || ''} />
        </div>
        <div>
          <Label htmlFor="linkedin">LinkedIn</Label>
          <Input id="linkedin" name="linkedin" defaultValue={initial.socialLinks.linkedin || ''} />
        </div>
      </div>

      <Button type="submit">Save Profile</Button>
    </form>
  )
}
