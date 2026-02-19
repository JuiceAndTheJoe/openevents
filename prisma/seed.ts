import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create categories
  const categories = [
    { name: 'Conference', slug: 'conference', description: 'Professional conferences and summits' },
    { name: 'Workshop', slug: 'workshop', description: 'Hands-on learning sessions' },
    { name: 'Meetup', slug: 'meetup', description: 'Casual community gatherings' },
    { name: 'Concert', slug: 'concert', description: 'Live music performances' },
    { name: 'Networking', slug: 'networking', description: 'Professional networking events' },
    { name: 'Sports', slug: 'sports', description: 'Sports events and competitions' },
    { name: 'Charity', slug: 'charity', description: 'Fundraising and charity events' },
    { name: 'Festival', slug: 'festival', description: 'Multi-day festivals and celebrations' },
  ]

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    })
  }
  console.log('Categories created')

  // Create a super admin user
  const adminPassword = await bcrypt.hash('Admin123!', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@openevents.local' },
    update: {},
    create: {
      email: 'admin@openevents.local',
      passwordHash: adminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      emailVerified: new Date(),
    },
  })

  // Assign SUPER_ADMIN and ATTENDEE roles to admin
  await prisma.userRole.upsert({
    where: { userId_role: { userId: admin.id, role: 'SUPER_ADMIN' } },
    update: {},
    create: { userId: admin.id, role: 'SUPER_ADMIN' },
  })
  await prisma.userRole.upsert({
    where: { userId_role: { userId: admin.id, role: 'ATTENDEE' } },
    update: {},
    create: { userId: admin.id, role: 'ATTENDEE' },
  })
  console.log('Super admin created: admin@openevents.local / Admin123!')

  // Create a demo organizer
  const organizerPassword = await bcrypt.hash('Organizer123!', 12)
  const organizer = await prisma.user.upsert({
    where: { email: 'organizer@openevents.local' },
    update: {},
    create: {
      email: 'organizer@openevents.local',
      passwordHash: organizerPassword,
      firstName: 'Demo',
      lastName: 'Organizer',
      emailVerified: new Date(),
    },
  })

  // Assign ORGANIZER and ATTENDEE roles
  await prisma.userRole.upsert({
    where: { userId_role: { userId: organizer.id, role: 'ORGANIZER' } },
    update: {},
    create: { userId: organizer.id, role: 'ORGANIZER' },
  })
  await prisma.userRole.upsert({
    where: { userId_role: { userId: organizer.id, role: 'ATTENDEE' } },
    update: {},
    create: { userId: organizer.id, role: 'ATTENDEE' },
  })

  // Create organizer profile
  const orgProfile = await prisma.organizerProfile.upsert({
    where: { userId: organizer.id },
    update: {},
    create: {
      userId: organizer.id,
      orgName: 'Demo Events Inc.',
      description: 'A demonstration organization for OpenEvents platform.',
      website: 'https://example.com',
    },
  })
  console.log('Demo organizer created: organizer@openevents.local / Organizer123!')

  // Create a demo event
  const demoEvent = await prisma.event.upsert({
    where: { slug: 'demo-tech-conference-2024' },
    update: {},
    create: {
      organizerId: orgProfile.id,
      title: 'Demo Tech Conference 2024',
      slug: 'demo-tech-conference-2024',
      description: 'Join us for an exciting tech conference featuring the latest in software development, AI, and cloud technologies.',
      descriptionHtml: '<p>Join us for an exciting tech conference featuring the latest in software development, AI, and cloud technologies.</p><p>This event will feature:</p><ul><li>Keynote speakers from industry leaders</li><li>Hands-on workshops</li><li>Networking opportunities</li><li>Career fair</li></ul>',
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      endDate: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000), // 31 days from now
      timezone: 'Europe/Stockholm',
      locationType: 'PHYSICAL',
      venue: 'Stockholm Convention Center',
      address: 'Mässvägen 1',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '125 80',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      publishedAt: new Date(),
    },
  })

  // Add conference category to event
  const conferenceCategory = await prisma.category.findUnique({
    where: { slug: 'conference' },
  })
  if (conferenceCategory) {
    await prisma.eventCategory.upsert({
      where: {
        eventId_categoryId: {
          eventId: demoEvent.id,
          categoryId: conferenceCategory.id,
        },
      },
      update: {},
      create: {
        eventId: demoEvent.id,
        categoryId: conferenceCategory.id,
      },
    })
  }

  // Create ticket types for the demo event
  await prisma.ticketType.upsert({
    where: { id: 'demo-early-bird' },
    update: {},
    create: {
      id: 'demo-early-bird',
      eventId: demoEvent.id,
      name: 'Early Bird',
      description: 'Limited early bird tickets at a special price',
      price: 99.00,
      currency: 'SEK',
      maxCapacity: 100,
      salesEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      isVisible: true,
      sortOrder: 0,
    },
  })

  await prisma.ticketType.upsert({
    where: { id: 'demo-general' },
    update: {},
    create: {
      id: 'demo-general',
      eventId: demoEvent.id,
      name: 'General Admission',
      description: 'Standard conference access including all sessions and lunch',
      price: 149.00,
      currency: 'SEK',
      maxCapacity: 500,
      isVisible: true,
      sortOrder: 1,
    },
  })

  await prisma.ticketType.upsert({
    where: { id: 'demo-vip' },
    update: {},
    create: {
      id: 'demo-vip',
      eventId: demoEvent.id,
      name: 'VIP Pass',
      description: 'Premium access including speaker dinner and exclusive workshops',
      price: 299.00,
      currency: 'SEK',
      maxCapacity: 50,
      isVisible: true,
      sortOrder: 2,
    },
  })

  // Create a discount code
  await prisma.discountCode.upsert({
    where: { eventId_code: { eventId: demoEvent.id, code: 'DEMO20' } },
    update: {},
    create: {
      eventId: demoEvent.id,
      code: 'DEMO20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      maxUses: 100,
      isActive: true,
    },
  })

  await prisma.discountCode.upsert({
    where: { eventId_code: { eventId: demoEvent.id, code: 'SPEAKER' } },
    update: {},
    create: {
      eventId: demoEvent.id,
      code: 'SPEAKER',
      discountType: 'FREE_TICKET',
      discountValue: 0,
      maxUses: 20,
      isActive: true,
    },
  })

  console.log('Demo event created: Demo Tech Conference 2024')

  // Create platform settings
  await prisma.platformSetting.upsert({
    where: { key: 'default_currency' },
    update: {},
    create: {
      key: 'default_currency',
      value: 'SEK',
      type: 'string',
    },
  })

  await prisma.platformSetting.upsert({
    where: { key: 'platform_name' },
    update: {},
    create: {
      key: 'platform_name',
      value: 'OpenEvents',
      type: 'string',
    },
  })

  console.log('Platform settings created')
  console.log('Seed completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
