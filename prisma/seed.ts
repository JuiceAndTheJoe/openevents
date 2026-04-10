import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

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
      mustChangePassword: true,
    },
  })

  await prisma.userRole.upsert({
    where: { userId_role: { userId: admin.id, role: 'SUPER_ADMIN' } },
    update: {},
    create: { userId: admin.id, role: 'SUPER_ADMIN' },
  })
  console.log('Super admin created: admin@openevents.local / Admin123!')

  // ============================================================================
  // CREATE MULTIPLE ORGANIZERS
  // ============================================================================

  const organizerPassword = await bcrypt.hash('Organizer123!', 12)

  const organizersData = [
    {
      email: 'events@nordictech.se',
      firstName: 'Erik',
      lastName: 'Lindqvist',
      orgName: 'Nordic Tech Events',
      description: 'Swedens leading technology conference organizer. We bring together innovators, developers, and business leaders to shape the future of technology in Scandinavia.',
      website: 'https://nordictechevents.se',
    },
    {
      email: 'hello@stockholmmusic.se',
      firstName: 'Anna',
      lastName: 'Bergström',
      orgName: 'Stockholm Music Collective',
      description: 'Curating unforgettable live music experiences across Stockholm. From intimate jazz clubs to large outdoor festivals, we celebrate musical diversity.',
      website: 'https://stockholmmusic.se',
    },
    {
      email: 'info@goteborgrunners.se',
      firstName: 'Magnus',
      lastName: 'Johansson',
      orgName: 'Göteborg Sports Events',
      description: 'Organizing premier running events, marathons, and sports competitions in western Sweden since 2010. Join thousands of athletes in our world-class events.',
      website: 'https://goteborgrunners.se',
    },
    {
      email: 'contact@malmonetwork.se',
      firstName: 'Sofia',
      lastName: 'Nielsen',
      orgName: 'Malmö Business Network',
      description: 'Connecting professionals across Öresund. Our networking events bring together entrepreneurs, executives, and innovators from Sweden and Denmark.',
      website: 'https://malmonetwork.se',
    },
    {
      email: 'team@uppsalafoundation.org',
      firstName: 'Lars',
      lastName: 'Andersson',
      orgName: 'Uppsala Charity Foundation',
      description: 'Dedicated to making a difference through community fundraising events. Every event we organize helps support local families, education, and healthcare initiatives.',
      website: 'https://uppsalafoundation.org',
    },
    {
      email: 'info@swedishfestivals.se',
      firstName: 'Maja',
      lastName: 'Eriksson',
      orgName: 'Swedish Festival Productions',
      description: 'Creating magical festival experiences that celebrate Swedish culture, food, and traditions. From midsummer celebrations to winter markets.',
      website: 'https://swedishfestivals.se',
    },
  ]

  const orgProfiles: Record<string, string> = {}

  for (const org of organizersData) {
    const user = await prisma.user.upsert({
      where: { email: org.email },
      update: {},
      create: {
        email: org.email,
        passwordHash: organizerPassword,
        firstName: org.firstName,
        lastName: org.lastName,
        emailVerified: new Date(),
      },
    })

    await prisma.userRole.upsert({
      where: { userId_role: { userId: user.id, role: 'ORGANIZER' } },
      update: {},
      create: { userId: user.id, role: 'ORGANIZER' },
    })
    const profile = await prisma.organizerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        orgName: org.orgName,
        description: org.description,
        website: org.website,
      },
    })

    orgProfiles[org.orgName] = profile.id
  }
  console.log('Organizers created')

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
  console.log('='.repeat(50))
  console.log('SEED COMPLETED!')
  console.log('='.repeat(50))
  console.log('')
  console.log('Admin login: admin@openevents.local / Admin123!')
  console.log('')
  console.log('Organizer logins (all use password: Organizer123!):')
  for (const org of organizersData) {
    console.log(`  - ${org.email}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
