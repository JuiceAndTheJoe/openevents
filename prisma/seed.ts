import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Helper to create dates relative to now
const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000)
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000)

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

  // ============================================================================
  // CREATE EVENTS
  // ============================================================================

  const events = [
    // ===== CONFERENCES =====
    {
      organizer: 'Nordic Tech Events',
      title: 'Nordic AI Summit 2025',
      slug: 'nordic-ai-summit-2025',
      description: 'The premier artificial intelligence conference in Scandinavia, bringing together researchers, practitioners, and business leaders.',
      descriptionHtml: `<p>Join us for the <strong>Nordic AI Summit 2025</strong>, the most anticipated artificial intelligence conference in Scandinavia.</p>
<h3>What to Expect</h3>
<ul>
<li>Keynotes from leading AI researchers at Google DeepMind, OpenAI, and Anthropic</li>
<li>Hands-on workshops on LLMs, computer vision, and MLOps</li>
<li>Startup showcase featuring 50+ Nordic AI companies</li>
<li>Networking sessions with 2000+ attendees</li>
</ul>
<h3>Topics Covered</h3>
<p>Large Language Models • Responsible AI • AI in Healthcare • Autonomous Systems • AI for Sustainability</p>`,
      startDate: daysFromNow(45),
      endDate: daysFromNow(46),
      venue: 'Stockholmsmässan',
      address: 'Mässvägen 1',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '125 80',
      tickets: [
        { name: 'Student Pass', price: 495, maxCapacity: 200, description: 'Valid student ID required. Access to all sessions.' },
        { name: 'Professional', price: 2495, maxCapacity: 1500, description: 'Full conference access including lunch and networking dinner.' },
        { name: 'Executive', price: 4995, maxCapacity: 100, description: 'VIP seating, executive lounge access, and private meeting rooms.' },
      ],
    },
    {
      organizer: 'Nordic Tech Events',
      title: 'DevOps Days Stockholm',
      slug: 'devops-days-stockholm-2025',
      description: 'Two days of talks, workshops, and open spaces focused on software development, IT infrastructure operations, and the intersection between them.',
      descriptionHtml: `<p><strong>DevOps Days Stockholm</strong> returns for its 8th year, bringing together developers, operations professionals, and everyone in between.</p>
<h3>Format</h3>
<ul>
<li>Single-track conference with curated talks</li>
<li>Open Space sessions driven by attendees</li>
<li>Ignite talks (5 minutes, 20 slides, auto-advancing)</li>
<li>Hands-on workshops</li>
</ul>
<p>Topics include CI/CD, Kubernetes, Platform Engineering, SRE, and DevSecOps.</p>`,
      startDate: daysFromNow(60),
      endDate: daysFromNow(61),
      venue: 'Nalen',
      address: 'Regeringsgatan 74',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '111 39',
      tickets: [
        { name: 'Early Bird', price: 1495, maxCapacity: 100, description: 'Limited early bird tickets. Full conference access.' },
        { name: 'Regular', price: 1995, maxCapacity: 300, description: 'Full conference access including all meals.' },
      ],
    },
    {
      organizer: 'Nordic Tech Events',
      title: 'Sustainable Tech Forum',
      slug: 'sustainable-tech-forum-2025',
      description: 'Exploring how technology can drive environmental sustainability and help businesses achieve their climate goals.',
      descriptionHtml: `<p>The <strong>Sustainable Tech Forum</strong> brings together climate scientists, tech leaders, and policymakers to discuss how technology can accelerate the transition to a sustainable future.</p>
<h3>Key Themes</h3>
<ul>
<li>Green Cloud Computing & Carbon-Aware Software</li>
<li>AI for Climate Modeling</li>
<li>Circular Economy Tech Solutions</li>
<li>Sustainable Supply Chain Technology</li>
<li>Electric Vehicle Infrastructure</li>
</ul>`,
      startDate: daysFromNow(90),
      endDate: daysFromNow(90),
      venue: 'Uppsala Konsert & Kongress',
      address: 'Vaksala torg 1',
      city: 'Uppsala',
      country: 'Sweden',
      postalCode: '753 31',
      tickets: [
        { name: 'General Admission', price: 995, maxCapacity: 400, description: 'Access to all sessions and lunch.' },
        { name: 'Premium', price: 1795, maxCapacity: 100, description: 'Priority seating and networking dinner included.' },
      ],
    },

    // ===== WORKSHOPS =====
    {
      organizer: 'Nordic Tech Events',
      title: 'Kubernetes Fundamentals Workshop',
      slug: 'kubernetes-fundamentals-workshop',
      description: 'A hands-on full-day workshop covering Kubernetes basics, from pods and deployments to services and ingress.',
      descriptionHtml: `<p>Get started with <strong>Kubernetes</strong> in this intensive hands-on workshop designed for developers and operations professionals.</p>
<h3>Prerequisites</h3>
<ul>
<li>Basic Docker knowledge</li>
<li>Familiarity with Linux command line</li>
<li>Laptop with Docker Desktop installed</li>
</ul>
<h3>What You'll Learn</h3>
<ul>
<li>Kubernetes architecture and components</li>
<li>Deploying and scaling applications</li>
<li>ConfigMaps, Secrets, and persistent storage</li>
<li>Networking and service discovery</li>
</ul>`,
      startDate: daysFromNow(21),
      endDate: daysFromNow(21),
      venue: 'Epicenter Stockholm',
      address: 'Mäster Samuelsgatan 36',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '111 57',
      tickets: [
        { name: 'Workshop Seat', price: 3995, maxCapacity: 25, description: 'Includes lunch, materials, and certificate of completion.' },
      ],
    },
    {
      organizer: 'Nordic Tech Events',
      title: 'React & TypeScript Masterclass',
      slug: 'react-typescript-masterclass',
      description: 'Deep dive into modern React development with TypeScript, covering advanced patterns, testing, and performance optimization.',
      descriptionHtml: `<p>Take your React skills to the next level in this comprehensive <strong>two-day masterclass</strong>.</p>
<h3>Day 1: Advanced Patterns</h3>
<ul>
<li>TypeScript generics and utility types</li>
<li>Compound components and render props</li>
<li>Custom hooks and state machines</li>
<li>Context optimization patterns</li>
</ul>
<h3>Day 2: Production Ready</h3>
<ul>
<li>Testing strategies with Vitest and Testing Library</li>
<li>Performance profiling and optimization</li>
<li>Server components and SSR patterns</li>
<li>Monorepo setup with Turborepo</li>
</ul>`,
      startDate: daysFromNow(35),
      endDate: daysFromNow(36),
      venue: 'SUP46',
      address: 'Regeringsgatan 29',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '111 53',
      tickets: [
        { name: 'Full Masterclass', price: 6995, maxCapacity: 20, description: 'Both days, all materials, lunch included.' },
        { name: 'Day 1 Only', price: 3995, maxCapacity: 5, description: 'Day 1 access only.' },
      ],
    },
    {
      organizer: 'Malmö Business Network',
      title: 'Startup Pitch Workshop',
      slug: 'startup-pitch-workshop-malmo',
      description: 'Perfect your investor pitch with hands-on coaching from experienced VCs and successful founders.',
      descriptionHtml: `<p>Whether you're preparing for your first angel round or Series A, this <strong>Startup Pitch Workshop</strong> will help you craft a compelling narrative.</p>
<h3>Workshop Structure</h3>
<ul>
<li>Pitch deck fundamentals and storytelling</li>
<li>Live pitch practice with VC feedback</li>
<li>Q&A handling and objection management</li>
<li>1-on-1 coaching sessions</li>
</ul>
<p>Limited to 12 startups for personalized attention.</p>`,
      startDate: daysFromNow(28),
      endDate: daysFromNow(28),
      venue: 'Minc Startup House',
      address: 'Anckargripsgatan 3',
      city: 'Malmö',
      country: 'Sweden',
      postalCode: '211 19',
      tickets: [
        { name: 'Startup Team (up to 3)', price: 2495, maxCapacity: 12, description: 'Bring your co-founders. Includes lunch and materials.' },
      ],
    },
    {
      organizer: 'Nordic Tech Events',
      title: 'Data Engineering with Python',
      slug: 'data-engineering-python-workshop',
      description: 'Build production-ready data pipelines using Python, Apache Airflow, and modern data stack tools.',
      descriptionHtml: `<p>Learn to build <strong>scalable data pipelines</strong> in this hands-on workshop for data engineers and analysts.</p>
<h3>Topics</h3>
<ul>
<li>ETL/ELT fundamentals</li>
<li>Apache Airflow orchestration</li>
<li>dbt for data transformation</li>
<li>Data quality and testing</li>
<li>Observability and monitoring</li>
</ul>`,
      startDate: daysFromNow(42),
      endDate: daysFromNow(42),
      venue: 'KTH Campus',
      address: 'Lindstedtsvägen 3',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '114 28',
      tickets: [
        { name: 'Workshop Pass', price: 3495, maxCapacity: 30, description: 'Full-day workshop with lunch and materials.' },
      ],
    },

    // ===== MEETUPS =====
    {
      organizer: 'Nordic Tech Events',
      title: 'Stockholm JavaScript Meetup',
      slug: 'stockholm-javascript-meetup-march',
      description: 'Monthly JavaScript community meetup featuring talks on the latest frameworks, tools, and best practices.',
      descriptionHtml: `<p>Join the <strong>Stockholm JavaScript community</strong> for our monthly meetup!</p>
<h3>This Month's Talks</h3>
<ul>
<li>"Server Components in Production" by Maria Svensson (Klarna)</li>
<li>"Building Real-time Apps with Convex" by Johan Lindberg</li>
<li>Lightning talks from the community</li>
</ul>
<p>Pizza and drinks provided. Networking afterwards!</p>`,
      startDate: daysFromNow(14),
      endDate: daysFromNow(14),
      venue: 'Spotify HQ',
      address: 'Regeringsgatan 19',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '111 53',
      tickets: [
        { name: 'Free Registration', price: 0, maxCapacity: 150, description: 'Pizza and drinks included.' },
      ],
    },
    {
      organizer: 'Nordic Tech Events',
      title: 'Women in Tech Stockholm',
      slug: 'women-in-tech-stockholm-april',
      description: 'A supportive community event for women in technology, featuring inspirational talks and mentorship opportunities.',
      descriptionHtml: `<p>Welcome to <strong>Women in Tech Stockholm</strong>, a monthly gathering celebrating and supporting women in the technology industry.</p>
<h3>This Month's Theme: Career Growth</h3>
<ul>
<li>Keynote: "From IC to Engineering Manager" by Lisa Eriksson (Ericsson)</li>
<li>Panel: Navigating Technical Leadership</li>
<li>Speed mentoring sessions</li>
</ul>`,
      startDate: daysFromNow(18),
      endDate: daysFromNow(18),
      venue: 'King Gaming',
      address: 'Sveavägen 44',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '111 34',
      tickets: [
        { name: 'Free Ticket', price: 0, maxCapacity: 100, description: 'Open to all women and non-binary individuals in tech.' },
      ],
    },
    {
      organizer: 'Malmö Business Network',
      title: 'Malmö Startup Drinks',
      slug: 'malmo-startup-drinks-march',
      description: 'Casual networking event for the Malmö startup community. No agenda, just great conversations.',
      descriptionHtml: `<p><strong>Malmö Startup Drinks</strong> - The most relaxed networking event in Skåne!</p>
<p>Whether you're a founder, employee, investor, or just curious about startups, come join us for drinks and conversations at our favorite spot in the city.</p>
<p>No pitches, no presentations - just genuine connections.</p>`,
      startDate: daysFromNow(10),
      endDate: daysFromNow(10),
      venue: 'Bastard Burgers Malmö',
      address: 'Lilla Torg 1',
      city: 'Malmö',
      country: 'Sweden',
      postalCode: '211 34',
      tickets: [
        { name: 'RSVP', price: 0, maxCapacity: 80, description: 'First drink on the house!' },
      ],
    },
    {
      organizer: 'Göteborg Sports Events',
      title: 'Gothenburg Running Club',
      slug: 'gothenburg-running-club-weekly',
      description: 'Weekly group runs through beautiful Gothenburg. All paces welcome.',
      descriptionHtml: `<p>Join the <strong>Gothenburg Running Club</strong> for our weekly group run!</p>
<h3>Details</h3>
<ul>
<li>Distance: 5-10km (multiple pace groups)</li>
<li>Meeting point: Götaplatsen fountain</li>
<li>Route: Slottsskogen loop</li>
</ul>
<p>Fika afterwards at Café Husaren!</p>`,
      startDate: daysFromNow(7),
      endDate: daysFromNow(7),
      venue: 'Götaplatsen',
      address: 'Götaplatsen',
      city: 'Gothenburg',
      country: 'Sweden',
      postalCode: '412 56',
      tickets: [
        { name: 'Join the Run', price: 0, maxCapacity: 50, description: 'Free to join. All levels welcome.' },
      ],
    },

    // ===== CONCERTS =====
    {
      organizer: 'Stockholm Music Collective',
      title: 'Nordic Jazz Night',
      slug: 'nordic-jazz-night-fasching',
      description: 'An evening of world-class Scandinavian jazz featuring the Jan Lundgren Trio and special guests.',
      descriptionHtml: `<p>Experience the magic of <strong>Nordic Jazz</strong> at Stockholm's legendary Fasching jazz club.</p>
<h3>Lineup</h3>
<ul>
<li>Jan Lundgren Trio (Sweden)</li>
<li>Solveig Slettahjell (Norway)</li>
<li>Special surprise guests</li>
</ul>
<p>Two sets: 19:00 and 21:30</p>`,
      startDate: daysFromNow(25),
      endDate: daysFromNow(25),
      venue: 'Fasching Jazz Club',
      address: 'Kungsgatan 63',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '111 22',
      tickets: [
        { name: 'General Standing', price: 350, maxCapacity: 150, description: 'Standing room with bar access.' },
        { name: 'Reserved Seating', price: 495, maxCapacity: 60, description: 'Guaranteed seat with table service.' },
      ],
    },
    {
      organizer: 'Stockholm Music Collective',
      title: 'Swedish Indie Showcase',
      slug: 'swedish-indie-showcase-2025',
      description: 'Discover the next wave of Swedish indie music. Four rising bands, one unforgettable night.',
      descriptionHtml: `<p><strong>Swedish Indie Showcase</strong> presents four emerging artists ready to take the music world by storm.</p>
<h3>Lineup</h3>
<ul>
<li>Wilda (Dream Pop)</li>
<li>Tunga Moln (Post-Punk)</li>
<li>Sommarljus (Indie Folk)</li>
<li>KÄRNA (Electronic Indie)</li>
</ul>
<p>Doors at 19:00, first act at 20:00.</p>`,
      startDate: daysFromNow(32),
      endDate: daysFromNow(32),
      venue: 'Debaser Strand',
      address: 'Hornstulls Strand 4',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '117 39',
      tickets: [
        { name: 'Early Bird', price: 195, maxCapacity: 100, description: 'Limited early bird tickets.' },
        { name: 'Regular', price: 275, maxCapacity: 400, description: 'General admission standing.' },
      ],
    },
    {
      organizer: 'Stockholm Music Collective',
      title: 'Classical Evening: Brahms Symphony',
      slug: 'classical-brahms-symphony-concert',
      description: 'The Royal Stockholm Philharmonic performs Brahms Symphony No. 4 and Piano Concerto No. 2.',
      descriptionHtml: `<p>An evening of <strong>Johannes Brahms</strong> performed by the world-renowned Royal Stockholm Philharmonic Orchestra.</p>
<h3>Program</h3>
<ul>
<li>Piano Concerto No. 2 in B-flat major, Op. 83</li>
<li>Symphony No. 4 in E minor, Op. 98</li>
</ul>
<p>Soloist: Yuja Wang (piano)<br>Conductor: Daniel Harding</p>`,
      startDate: daysFromNow(55),
      endDate: daysFromNow(55),
      venue: 'Konserthuset Stockholm',
      address: 'Hötorget 8',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '111 57',
      tickets: [
        { name: 'Balcony', price: 395, maxCapacity: 200, description: 'Upper balcony seating.' },
        { name: 'Orchestra', price: 595, maxCapacity: 400, description: 'Main floor seating.' },
        { name: 'Premium', price: 895, maxCapacity: 100, description: 'Best seats in the house, includes program.' },
      ],
    },
    {
      organizer: 'Stockholm Music Collective',
      title: 'Electronic Nights: Röyksopp DJ Set',
      slug: 'electronic-nights-royksopp',
      description: 'Norwegian electronic duo Röyksopp brings their legendary DJ set to Stockholm.',
      descriptionHtml: `<p>Experience the iconic sounds of <strong>Röyksopp</strong> in an intimate club setting.</p>
<p>The Norwegian electronic music pioneers return to Stockholm for a special DJ set, blending their classic tracks with the latest electronic music.</p>
<h3>Event Info</h3>
<ul>
<li>Doors: 22:00</li>
<li>DJ Set: 00:00 - 04:00</li>
<li>Age: 23+</li>
</ul>`,
      startDate: daysFromNow(40),
      endDate: daysFromNow(41),
      venue: 'Berns',
      address: 'Berzelii Park',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '111 47',
      tickets: [
        { name: 'General Entry', price: 495, maxCapacity: 600, description: 'Club access from 22:00.' },
        { name: 'VIP Table', price: 3500, maxCapacity: 20, description: 'Reserved table for 6 with bottle service.' },
      ],
    },

    // ===== NETWORKING =====
    {
      organizer: 'Malmö Business Network',
      title: 'Øresund Business Connect',
      slug: 'oresund-business-connect-2025',
      description: 'Cross-border networking event connecting Swedish and Danish business professionals.',
      descriptionHtml: `<p><strong>Øresund Business Connect</strong> bridges the gap between Swedish and Danish business communities.</p>
<h3>Program</h3>
<ul>
<li>09:00 - Welcome coffee</li>
<li>09:30 - Keynote: Cross-border Opportunities</li>
<li>10:30 - Structured networking rounds</li>
<li>12:00 - Lunch and free networking</li>
<li>14:00 - Industry breakout sessions</li>
</ul>`,
      startDate: daysFromNow(50),
      endDate: daysFromNow(50),
      venue: 'Malmö Live',
      address: 'Dag Hammarskjölds torg 4',
      city: 'Malmö',
      country: 'Sweden',
      postalCode: '211 18',
      tickets: [
        { name: 'Business Pass', price: 795, maxCapacity: 200, description: 'Full day including lunch and all sessions.' },
      ],
    },
    {
      organizer: 'Malmö Business Network',
      title: 'Founders Breakfast Club',
      slug: 'founders-breakfast-club-april',
      description: 'Monthly breakfast meetup for startup founders. Share challenges, exchange ideas, find collaborators.',
      descriptionHtml: `<p>Start your day with the <strong>Founders Breakfast Club</strong>!</p>
<p>A curated gathering of 30 founders for meaningful conversations over breakfast.</p>
<h3>Format</h3>
<ul>
<li>07:30 - Breakfast served</li>
<li>08:00 - Round table introductions</li>
<li>08:30 - This month's topic: "Hiring Your First 10"</li>
<li>09:15 - Open networking</li>
<li>09:45 - End</li>
</ul>`,
      startDate: daysFromNow(15),
      endDate: daysFromNow(15),
      venue: 'Story Hotel Studio Malmö',
      address: 'Carlsgatan 10A',
      city: 'Malmö',
      country: 'Sweden',
      postalCode: '211 20',
      tickets: [
        { name: 'Breakfast Seat', price: 195, maxCapacity: 30, description: 'Full breakfast included. Founders only.' },
      ],
    },
    {
      organizer: 'Nordic Tech Events',
      title: 'CTO Circle Stockholm',
      slug: 'cto-circle-stockholm-q2',
      description: 'Exclusive networking dinner for CTOs and VP Engineering. Off-the-record discussions on leadership challenges.',
      descriptionHtml: `<p><strong>CTO Circle</strong> is an invitation-only dinner for technical leaders in Stockholm.</p>
<h3>This Quarter's Theme</h3>
<p>"Building Engineering Culture at Scale"</p>
<ul>
<li>How do you maintain culture as you grow from 20 to 200 engineers?</li>
<li>Remote vs hybrid vs in-office: What actually works?</li>
<li>Developer experience and productivity metrics</li>
</ul>
<p>Chatham House rules apply. Limited to 16 attendees.</p>`,
      startDate: daysFromNow(38),
      endDate: daysFromNow(38),
      venue: 'Operakällaren',
      address: 'Karl XII:s torg',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '111 86',
      tickets: [
        { name: 'Dinner Seat', price: 1295, maxCapacity: 16, description: 'Three-course dinner with wine pairing.' },
      ],
    },

    // ===== SPORTS =====
    {
      organizer: 'Göteborg Sports Events',
      title: 'Gothenburg Half Marathon 2025',
      slug: 'gothenburg-half-marathon-2025',
      description: 'Run through the beautiful streets of Gothenburg in Sweden\'s largest half marathon event.',
      descriptionHtml: `<p>Join 30,000+ runners in the <strong>Gothenburg Half Marathon</strong>, one of the world's most beautiful urban races.</p>
<h3>Course Highlights</h3>
<ul>
<li>Start at Slottsskogen</li>
<li>Run past Älvsborgsbron bridge</li>
<li>Finish at Götaplatsen with cheering crowds</li>
</ul>
<h3>Race Info</h3>
<ul>
<li>Distance: 21.1 km</li>
<li>Start time: 09:00</li>
<li>Time limit: 3 hours</li>
</ul>`,
      startDate: daysFromNow(75),
      endDate: daysFromNow(75),
      venue: 'Slottsskogen',
      address: 'Slottsskogen',
      city: 'Gothenburg',
      country: 'Sweden',
      postalCode: '414 76',
      tickets: [
        { name: 'Early Bird Entry', price: 495, maxCapacity: 5000, description: 'Includes bib, timing chip, and finisher medal.' },
        { name: 'Regular Entry', price: 695, maxCapacity: 25000, description: 'Includes bib, timing chip, and finisher medal.' },
      ],
    },
    {
      organizer: 'Göteborg Sports Events',
      title: 'CrossFit West Coast Throwdown',
      slug: 'crossfit-west-coast-throwdown-2025',
      description: 'Two-day CrossFit competition for all levels. Individual and team categories.',
      descriptionHtml: `<p>The <strong>West Coast Throwdown</strong> returns for its 6th year!</p>
<h3>Competition Categories</h3>
<ul>
<li>RX Individual (Men/Women)</li>
<li>Scaled Individual (Men/Women)</li>
<li>Team of 4 (Mixed)</li>
<li>Masters 40+</li>
</ul>
<h3>Schedule</h3>
<ul>
<li>Saturday: 3 workouts, athlete party</li>
<li>Sunday: 2 workouts, finals, awards</li>
</ul>`,
      startDate: daysFromNow(65),
      endDate: daysFromNow(66),
      venue: 'Prioritet Serneke Arena',
      address: 'Skånegatan 1',
      city: 'Gothenburg',
      country: 'Sweden',
      postalCode: '412 51',
      tickets: [
        { name: 'Athlete Registration - Individual', price: 995, maxCapacity: 200, description: 'Both days, competition entry, athlete shirt.' },
        { name: 'Athlete Registration - Team', price: 2495, maxCapacity: 50, description: 'Team of 4, both days, team shirts.' },
        { name: 'Spectator Pass', price: 150, maxCapacity: 1000, description: 'Both days access to watch the competition.' },
      ],
    },
    {
      organizer: 'Göteborg Sports Events',
      title: 'Swedish Padel Championship',
      slug: 'swedish-padel-championship-2025',
      description: 'The national padel championship featuring top players from across Sweden.',
      descriptionHtml: `<p>Watch Sweden's best padel players compete for the national title at the <strong>Swedish Padel Championship</strong>.</p>
<h3>Categories</h3>
<ul>
<li>Men's Doubles</li>
<li>Women's Doubles</li>
<li>Mixed Doubles</li>
<li>Veterans 45+</li>
</ul>
<p>Qualifying rounds Friday, semifinals Saturday, finals Sunday.</p>`,
      startDate: daysFromNow(80),
      endDate: daysFromNow(82),
      venue: 'Padel Center Gothenburg',
      address: 'Importgatan 4',
      city: 'Gothenburg',
      country: 'Sweden',
      postalCode: '422 46',
      tickets: [
        { name: 'Day Pass', price: 195, maxCapacity: 500, description: 'Single day spectator access.' },
        { name: 'Finals Day', price: 295, maxCapacity: 800, description: 'Sunday finals including awards ceremony.' },
        { name: 'Full Tournament', price: 495, maxCapacity: 300, description: 'All three days access.' },
      ],
    },
    {
      organizer: 'Göteborg Sports Events',
      title: 'Midnight Sun Trail Run',
      slug: 'midnight-sun-trail-run-2025',
      description: 'Experience the magic of running under the midnight sun in northern Sweden.',
      descriptionHtml: `<p>Run through breathtaking arctic landscapes during the <strong>Midnight Sun Trail Run</strong>.</p>
<h3>Race Options</h3>
<ul>
<li>Ultra: 63 km</li>
<li>Marathon: 42 km</li>
<li>Half: 21 km</li>
<li>Mini: 10 km</li>
</ul>
<h3>Experience</h3>
<ul>
<li>Run under 24-hour daylight</li>
<li>Remote mountain trails</li>
<li>Aid stations with local delicacies</li>
<li>Post-race sauna and celebration</li>
</ul>`,
      startDate: daysFromNow(100),
      endDate: daysFromNow(100),
      venue: 'Abisko National Park',
      address: 'Abisko Turiststation',
      city: 'Abisko',
      country: 'Sweden',
      postalCode: '981 07',
      tickets: [
        { name: 'Mini (10km)', price: 495, maxCapacity: 200, description: 'Entry, bib, medal, post-race meal.' },
        { name: 'Half (21km)', price: 795, maxCapacity: 300, description: 'Entry, bib, medal, post-race meal.' },
        { name: 'Marathon (42km)', price: 1095, maxCapacity: 200, description: 'Entry, bib, medal, post-race meal, drop bag service.' },
        { name: 'Ultra (63km)', price: 1595, maxCapacity: 100, description: 'Entry, bib, medal, post-race meal, drop bag service, GPS tracker.' },
      ],
    },

    // ===== CHARITY =====
    {
      organizer: 'Uppsala Charity Foundation',
      title: 'Run for Education 2025',
      slug: 'run-for-education-2025',
      description: 'Family-friendly charity run supporting educational programs for underprivileged children in Sweden.',
      descriptionHtml: `<p>Join thousands of runners in <strong>Run for Education</strong>, raising money for children's education programs.</p>
<h3>Choose Your Distance</h3>
<ul>
<li>Kids Run: 1 km</li>
<li>Family Run: 3 km</li>
<li>Challenge Run: 10 km</li>
</ul>
<h3>Impact</h3>
<p>100% of registration fees go directly to educational programs. Last year we raised over 2 million SEK and helped 500+ children access after-school tutoring.</p>`,
      startDate: daysFromNow(58),
      endDate: daysFromNow(58),
      venue: 'Stadsträdgården Uppsala',
      address: 'Svandammen',
      city: 'Uppsala',
      country: 'Sweden',
      postalCode: '753 09',
      tickets: [
        { name: 'Kids Run (1km)', price: 95, maxCapacity: 300, description: 'Ages 4-12. Includes medal and snacks.' },
        { name: 'Family Run (3km)', price: 195, maxCapacity: 500, description: 'All ages. Includes medal and refreshments.' },
        { name: 'Challenge Run (10km)', price: 295, maxCapacity: 400, description: 'Timed race with chip timing and finisher medal.' },
      ],
    },
    {
      organizer: 'Uppsala Charity Foundation',
      title: 'Charity Gala Dinner',
      slug: 'charity-gala-dinner-2025',
      description: 'An elegant evening supporting mental health initiatives, featuring fine dining, live entertainment, and a charity auction.',
      descriptionHtml: `<p>Join us for the annual <strong>Charity Gala Dinner</strong>, an evening of elegance supporting mental health awareness and treatment programs.</p>
<h3>Evening Program</h3>
<ul>
<li>18:00 - Welcome champagne reception</li>
<li>19:00 - Four-course dinner</li>
<li>21:00 - Live auction with exclusive items</li>
<li>22:00 - Live music and dancing</li>
</ul>
<p>Dress code: Black tie</p>`,
      startDate: daysFromNow(70),
      endDate: daysFromNow(70),
      venue: 'Grand Hôtel Stockholm',
      address: 'Södra Blasieholmshamnen 8',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '103 27',
      tickets: [
        { name: 'Individual Seat', price: 2495, maxCapacity: 200, description: 'Four-course dinner with wine pairing.' },
        { name: 'Table of 8', price: 17500, maxCapacity: 25, description: 'Reserved table, premium placement, champagne welcome.' },
      ],
    },
    {
      organizer: 'Uppsala Charity Foundation',
      title: 'Beach Cleanup Day',
      slug: 'beach-cleanup-day-stockholm-2025',
      description: 'Join volunteers cleaning Stockholm\'s archipelago beaches. Make a difference for marine life and our environment.',
      descriptionHtml: `<p>Help us protect the Baltic Sea ecosystem at our annual <strong>Beach Cleanup Day</strong>.</p>
<h3>Event Details</h3>
<ul>
<li>Ferry transport from Strömkajen</li>
<li>Equipment provided (gloves, bags, pickers)</li>
<li>Lunch on the island</li>
<li>Certificate of participation</li>
</ul>
<p>Families with children 10+ welcome. A perfect way to combine outdoor activity with environmental action.</p>`,
      startDate: daysFromNow(48),
      endDate: daysFromNow(48),
      venue: 'Strömkajen Ferry Terminal',
      address: 'Strömkajen',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '111 30',
      tickets: [
        { name: 'Volunteer Registration', price: 0, maxCapacity: 150, description: 'Free! Lunch and ferry included. Minimum age 10.' },
      ],
    },

    // ===== FESTIVALS =====
    {
      organizer: 'Swedish Festival Productions',
      title: 'Stockholm Food Festival 2025',
      slug: 'stockholm-food-festival-2025',
      description: 'Three days of culinary excellence featuring top chefs, food trucks, wine tastings, and cooking demonstrations.',
      descriptionHtml: `<p>Experience the best of Swedish and international cuisine at the <strong>Stockholm Food Festival</strong>.</p>
<h3>Festival Highlights</h3>
<ul>
<li>100+ food vendors and restaurants</li>
<li>Celebrity chef demonstrations</li>
<li>Wine and craft beer tastings</li>
<li>Local produce market</li>
<li>Kids cooking workshops</li>
</ul>
<h3>Featured Chefs</h3>
<p>Magnus Nilsson • Niklas Ekstedt • Frida Ronge • Titti Qvarnström</p>`,
      startDate: daysFromNow(85),
      endDate: daysFromNow(87),
      venue: 'Kungsträdgården',
      address: 'Kungsträdgården',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '111 47',
      tickets: [
        { name: 'Day Pass', price: 195, maxCapacity: 5000, description: 'Single day entry.' },
        { name: 'Weekend Pass', price: 395, maxCapacity: 3000, description: 'All three days entry.' },
        { name: 'VIP Tasting Pass', price: 895, maxCapacity: 200, description: 'All days + VIP lounge + tasting tokens worth 500 SEK.' },
      ],
    },
    {
      organizer: 'Swedish Festival Productions',
      title: 'Midsommar Festival Dalarna',
      slug: 'midsommar-festival-dalarna-2025',
      description: 'Celebrate the most Swedish of traditions at our authentic Midsummer festival in beautiful Dalarna.',
      descriptionHtml: `<p>Experience an authentic Swedish <strong>Midsommar</strong> celebration in the heart of Dalarna!</p>
<h3>Traditions</h3>
<ul>
<li>Raising of the maypole (majstång)</li>
<li>Traditional folk dancing</li>
<li>Flower crown making workshops</li>
<li>Classic Midsummer feast with herring, potatoes, and strawberries</li>
<li>Live folk music</li>
</ul>
<p>An unforgettable way to experience Swedish culture and traditions.</p>`,
      startDate: daysFromNow(110),
      endDate: daysFromNow(111),
      venue: 'Tällberg Village',
      address: 'Tällberg',
      city: 'Tällberg',
      country: 'Sweden',
      postalCode: '793 70',
      tickets: [
        { name: 'Festival Pass', price: 495, maxCapacity: 500, description: 'Both days, includes Midsummer feast.' },
        { name: 'Family Pass (2 adults + 2 kids)', price: 995, maxCapacity: 150, description: 'Both days for the whole family.' },
      ],
    },
    {
      organizer: 'Swedish Festival Productions',
      title: 'Winter Light Festival',
      slug: 'winter-light-festival-stockholm-2025',
      description: 'Illuminate the dark Swedish winter with stunning light installations, performances, and warm drinks.',
      descriptionHtml: `<p>The <strong>Winter Light Festival</strong> transforms Stockholm into a magical wonderland of light and color.</p>
<h3>Installations</h3>
<ul>
<li>Aurora Borealis simulation at Kungsträdgården</li>
<li>Interactive light maze at Skansen</li>
<li>Floating lanterns at Djurgårdsbrunnsviken</li>
<li>Light sculptures by international artists</li>
</ul>
<h3>Activities</h3>
<p>Night markets • Hot chocolate stations • Fire shows • DJ sets • Guided tours</p>`,
      startDate: daysFromNow(120),
      endDate: daysFromNow(125),
      venue: 'Multiple Locations',
      address: 'Sergels Torg (main hub)',
      city: 'Stockholm',
      country: 'Sweden',
      postalCode: '111 57',
      tickets: [
        { name: 'Single Evening', price: 145, maxCapacity: 10000, description: 'Access to all installations for one evening.' },
        { name: 'Festival Pass', price: 295, maxCapacity: 5000, description: 'Unlimited access all 6 days.' },
        { name: 'Guided Tour', price: 395, maxCapacity: 500, description: 'Evening guided tour + mulled wine + single evening access.' },
      ],
    },
    {
      organizer: 'Swedish Festival Productions',
      title: 'Gothenburg Beer Week',
      slug: 'gothenburg-beer-week-2025',
      description: 'A week-long celebration of craft beer featuring 200+ breweries, tastings, and food pairings.',
      descriptionHtml: `<p><strong>Gothenburg Beer Week</strong> is Scandinavia's premier craft beer festival.</p>
<h3>What to Expect</h3>
<ul>
<li>200+ Swedish and international craft breweries</li>
<li>Master brewer talks and workshops</li>
<li>Beer and food pairing dinners</li>
<li>Homebrewing competitions</li>
<li>Live music every night</li>
</ul>
<p>Main festival venue at Eriksbergshallen, with satellite events at pubs across the city.</p>`,
      startDate: daysFromNow(95),
      endDate: daysFromNow(99),
      venue: 'Eriksbergshallen',
      address: 'Dockepiren',
      city: 'Gothenburg',
      country: 'Sweden',
      postalCode: '417 64',
      tickets: [
        { name: 'Day Pass', price: 295, maxCapacity: 2000, description: 'Single day entry with tasting glass.' },
        { name: 'Weekend Pass', price: 595, maxCapacity: 1000, description: 'Friday-Sunday access with tasting glass and tokens.' },
        { name: 'Full Week VIP', price: 1495, maxCapacity: 200, description: 'All days, VIP lounge, meet the brewers sessions, exclusive tastings.' },
      ],
    },
  ]

  // Create all events
  for (const eventData of events) {
    const organizerId = orgProfiles[eventData.organizer]

    if (!organizerId) {
      console.error(`Missing organizer for event: ${eventData.title}`)
      continue
    }

    // Create the event
    const event = await prisma.event.upsert({
      where: { slug: eventData.slug },
      update: {},
      create: {
        organizerId,
        title: eventData.title,
        slug: eventData.slug,
        description: eventData.description,
        descriptionHtml: eventData.descriptionHtml,
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        timezone: 'Europe/Stockholm',
        locationType: 'PHYSICAL',
        venue: eventData.venue,
        address: eventData.address,
        city: eventData.city,
        country: eventData.country,
        postalCode: eventData.postalCode,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        publishedAt: new Date(),
      },
    })

    // Create ticket types
    for (let i = 0; i < eventData.tickets.length; i++) {
      const ticket = eventData.tickets[i]
      const ticketId = `${eventData.slug}-ticket-${i}`

      await prisma.ticketType.upsert({
        where: { id: ticketId },
        update: {},
        create: {
          id: ticketId,
          eventId: event.id,
          name: ticket.name,
          description: ticket.description,
          price: ticket.price,
          currency: 'SEK',
          maxCapacity: ticket.maxCapacity,
          isVisible: true,
          sortOrder: i,
        },
      })
    }

    console.log(`Created event: ${eventData.title}`)
  }

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
  console.log('')
  console.log(`Total events created: ${events.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
