import { redirect } from 'next/navigation'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AttendeeProfileForm } from '@/components/profile/AttendeeProfileForm'

export default async function AttendeeProfilePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!hasRole(user.roles, 'ATTENDEE')) {
    redirect('/events')
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      image: true,
    },
  })

  if (!dbUser) {
    redirect('/login')
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <AttendeeProfileForm
        initial={{
          id: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.firstName || '',
          lastName: dbUser.lastName || '',
          image: dbUser.image || '',
        }}
      />
    </div>
  )
}
