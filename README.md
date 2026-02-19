# OpenEvents

An open-source event management and ticketing platform, similar to Eventbrite. Built with Next.js, TypeScript, and deployed on Eyevinn Open Source Cloud (OSC).

## Features

- **Event Management**: Create, edit, and publish events with rich details
- **Ticketing**: Multiple ticket types, capacity management, and discount codes
- **User Roles**: Attendees, Organizers, and Super Admins
- **Authentication**: Email/password and OAuth (Google, GitHub)
- **Media Storage**: Upload event images and videos
- **Order Processing**: Checkout flow with PayPal stub (ready for live integration)
- **PDF Tickets**: Downloadable/printable ticket PDFs with QR codes
- **Organizer Dashboard**: Sales statistics, order management, and analytics

## Tech Stack

- **Frontend**: Next.js 14+ with App Router, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (on OSC)
- **Cache**: Valkey/Redis (on OSC)
- **Storage**: MinIO/S3 (on OSC)
- **Authentication**: NextAuth.js
- **Deployment**: Eyevinn Open Source Cloud

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Access to OSC services (or local PostgreSQL, Redis, MinIO)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/JuiceAndTheJoe/openevents.git
   cd openevents
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Generate Prisma client and run migrations:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

5. Seed the database (optional):
   ```bash
   npm run db:seed
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

### Demo Accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@openevents.local | Admin123! |
| Organizer | organizer@openevents.local | Organizer123! |

## Project Structure

```
openevents/
├── prisma/               # Database schema and migrations
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── (auth)/       # Authentication pages
│   │   ├── (public)/     # Public pages (events)
│   │   ├── (dashboard)/  # User/Organizer dashboard
│   │   ├── (admin)/      # Super Admin panel
│   │   └── api/          # API routes
│   ├── components/       # React components
│   ├── lib/              # Utilities and services
│   └── types/            # TypeScript types
├── docs/                 # Documentation
└── public/               # Static assets
```

## Development

### Database Commands

```bash
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Run migrations (dev)
npm run db:push        # Push schema changes
npm run db:seed        # Seed database
npm run db:studio      # Open Prisma Studio
npm run db:reset       # Reset database
```

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Documentation

- [Architecture](./ARCHITECTURE.md) - System design and infrastructure
- [Contributing](./CONTRIBUTING.md) - How to contribute

## Deployment

This project is designed to be deployed on Eyevinn Open Source Cloud (OSC). See [ARCHITECTURE.md](./ARCHITECTURE.md) for OSC service configuration.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.
