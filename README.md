# OpenEvents

An open-source event management and ticketing platform built for [Streaming Tech Sweden 2026](https://www.streamingtech.se/). Built with Next.js, TypeScript, and deployed on [Eyevinn Open Source Cloud (OSC)](https://www.osaas.io/).

**Live site:** [events.apps.osaas.io](https://events.apps.osaas.io)

## Features

### Event Management
- Create, edit, and publish events with rich details
- Cover images and media uploads
- Event visibility controls (public/private)
- Event status workflow (draft, published, cancelled, completed)

### Ticketing & Sales
- Multiple ticket types with individual pricing and capacity
- Discount codes (percentage, fixed amount, free tickets)
- Group discounts for bulk purchases
- Invoice payment option for B2B customers
- Ticket reservation system during checkout
- Real-time availability tracking

### Speakers & Agenda
- Speaker profiles with photos, bios, and social links
- Drag-and-drop speaker ordering
- Agenda/schedule builder with time slots
- Speaker assignment to agenda items

### Payments
- Stripe integration for online payments
- Invoice billing for corporate customers
- Automated refund processing
- VAT handling (25% included)

### Attendee Management
- PDF tickets with QR codes
- QR code scanner for event check-in
- Attendee export to CSV/Excel
- Per-ticket attendee information

### Organizer Dashboard
- Sales statistics and revenue tracking
- 30-day sales trend charts
- Order management with filtering and search
- Bulk order actions and CSV export
- Ticket type and discount code management

### Admin Panel
- Platform-wide statistics
- User management with role assignment
- Create accounts with one-time passwords
- Event overview across all organizers

### Authentication
- Organizer login with email/password
- Role-based access control (Organizer, Super Admin)
- Guest checkout for attendees (no account required)
- Account deletion with grace period

## Tech Stack

- **Frontend**: Next.js 14+ with App Router, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (on OSC)
- **Cache**: Valkey/Redis (on OSC)
- **Storage**: MinIO/S3 (on OSC)
- **Authentication**: NextAuth.js
- **Payments**: Stripe
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
├── prisma/                    # Database schema and migrations
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Organizer authentication
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── forgot-password/
│   │   │   └── reset-password/
│   │   ├── (public)/          # Public pages
│   │   │   ├── events/        # Event listing and details
│   │   │   │   └── [slug]/
│   │   │   │       └── checkout/
│   │   │   └── orders/        # Order confirmation
│   │   ├── (dashboard)/       # Organizer & admin dashboard
│   │   │   └── dashboard/
│   │   │       ├── events/    # Event management
│   │   │       │   ├── new/
│   │   │       │   └── [id]/
│   │   │       │       ├── edit/
│   │   │       │       ├── orders/
│   │   │       │       ├── tickets/
│   │   │       │       ├── discounts/
│   │   │       │       └── scan/
│   │   │       ├── admin/     # Super admin panel
│   │   │       │   └── users/
│   │   │       ├── profile/
│   │   │       ├── settings/
│   │   │       └── scan/      # Quick ticket scanner
│   │   └── api/               # API routes
│   │       ├── auth/
│   │       ├── events/
│   │       │   └── [id]/
│   │       │       ├── speakers/
│   │       │       ├── agenda/
│   │       │       ├── ticket-types/
│   │       │       └── discount-codes/
│   │       ├── orders/
│   │       │   └── [id]/
│   │       │       ├── pay/
│   │       │       ├── capture/
│   │       │       ├── refund/
│   │       │       └── mark-paid/
│   │       ├── dashboard/
│   │       ├── admin/
│   │       ├── webhooks/
│   │       └── upload/
│   ├── components/            # React components
│   │   ├── ui/                # Base UI components
│   │   ├── auth/              # Authentication
│   │   ├── events/            # Event display & editing
│   │   ├── tickets/           # Checkout & tickets
│   │   ├── dashboard/         # Dashboard widgets
│   │   ├── admin/             # Admin components
│   │   └── layout/            # Layout components
│   ├── lib/                   # Shared libraries
│   │   ├── auth/              # Authentication utilities
│   │   ├── db/                # Prisma client
│   │   ├── email/             # Email service
│   │   ├── storage/           # S3/MinIO utilities
│   │   ├── payments/          # Stripe integration
│   │   ├── analytics/         # Dashboard analytics
│   │   └── validations/       # Zod schemas
│   └── types/                 # TypeScript types
├── docs/                      # Documentation
└── public/                    # Static assets
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
npm test               # Run all tests
npm run test:watch     # Run tests in watch mode
```

### Linting

```bash
npm run lint
```

## Documentation

- [Architecture](./ARCHITECTURE.md) - System design and infrastructure
- [Contributing](./CONTRIBUTING.md) - How to contribute
- [Setup Guide](./docs/SETUP.md) - Detailed setup instructions
- [Email Setup](./docs/SETUP_EMAIL.md) - Email configuration
- [Storage Setup](./docs/SETUP_STORAGE.md) - MinIO/S3 configuration

## Deployment

This project is deployed on [Eyevinn Open Source Cloud (OSC)](https://www.osaas.io/) at [events.apps.osaas.io](https://events.apps.osaas.io).

### Option 1: Contribute to the Existing Deployment

To contribute features or fixes to the live site at events.apps.osaas.io:

1. Fork or clone [github.com/JuiceAndTheJoe/openevents](https://github.com/JuiceAndTheJoe/openevents)
2. Set up your local development environment (see [Quick Start](#quick-start))
3. Make your changes following the guidelines in [CONTRIBUTING.md](./CONTRIBUTING.md)
4. Submit a pull request to `main`

**Note:** Merged changes will only appear on the live site after someone with access to the OpenEvents OSC account restarts the application.

### Option 2: Deploy Your Own Instance

To deploy a separate OpenEvents instance on your own OSC account:

1. Fork the repository to your GitHub account
2. Ensure your AI coding assistant (Claude Code, Cursor, etc.) is connected to GitHub and [OSC via MCP](https://www.npmjs.com/package/@osaas/mcp)
3. Ask your assistant: *"Set up OpenEvents on my OSC from my fork"*

The assistant will provision the required OSC services (PostgreSQL, Valkey, MinIO, Web Runner) and configure the environment.

To deploy changes pushed to your fork's `main` branch, restart your Web Runner instance through OSC.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for details on OSC service configuration.

## Known Limitations & Recommendations

This version of OpenEvents was built specifically for Streaming Tech Sweden 2026 and has some limitations that should be addressed for broader use.

### Email Delivery

The email integration is fully functional, but **emails sent through OSC's default mail service will not be delivered**. Email providers like Gmail and Outlook block messages from `@users.osaas.io` addresses.

**Impact:** Users will not receive order confirmations, tickets, or receipts via email until a reputable email provider is configured.

**Recommendation:** Configure a third-party email service (SendGrid, Postmark, AWS SES, etc.) via the environment variables in `.env`. See [Email Setup](./docs/SETUP_EMAIL.md) for configuration details.

### Invoice Payments

Invoice payment functionality is currently tied to Eyevinn. When users select invoice as their payment method, they are prompted to send payment details to `info@eyevinn.se`, regardless of which organizer created the event.

**Recommendation:** For other organizations, update the invoice instructions in the checkout flow to point to the appropriate billing contact.

### Guest Checkout Only

Ticket buyers do not create accounts on the platform. This was a deliberate decision to minimize friction during the purchase process.

**Impact:** Combined with the email delivery limitation above, buyers currently have limited ways to retrieve their ticket information after purchase. They cannot sign in to view past orders.

**Recommendation:** For production use, either:
- Configure working email delivery (priority)
- Implement an order lookup feature using email + order number
- Add optional account creation during checkout

## Temporary Launch Redirects

> **Note:** This section describes a temporary configuration for the platform launch. Remove this section and revert the changes when no longer needed.

During the initial launch period, the homepage (`/`) and events listing page (`/events`) are temporarily redirected to `/about`. This allows sharing the specific event URL (`/events/streaming-tech-2026-5fa0c1d6`) while keeping the general discovery pages hidden.

### What's Affected

- **Middleware** (`src/middleware.ts`): Redirects `/` and `/events` to `/about` with a 307 (Temporary Redirect)
- **Header** (`src/components/layout/Header.tsx`):
  - Logo links to `/about` instead of `/`
  - Sign-out redirects to `/about`
  - "Streaming Tech 2026" button added (links to `/events/streaming-tech-2026-5fa0c1d6`, or to `https://www.streamingtech.se/stswe26.html` when already on the event page)
  - "Create Event" button restyled as secondary (outline)
- **About page** (`src/app/(public)/about/page.tsx`):
  - Added "Streaming Tech Sweden 2026" section with link to the event page

### How to Revert

Search for `TEMPORARY` in the codebase to find all affected locations:

1. **Remove the redirect block in middleware** (`src/middleware.ts`):
   Delete the "TEMPORARY LAUNCH REDIRECT" section (approximately lines 48-58)

2. **Revert the Header component** (`src/components/layout/Header.tsx`):
   - Change logo `href="/about"` back to `href="/"`
   - Change both `signOut({ callbackUrl: '/about' })` calls back to `signOut({ callbackUrl: '/' })`
   - Remove the `isOnFeaturedEvent` and `featuredEventHref` variables
   - Remove the "Streaming Tech 2026" button (desktop and mobile, using `<a>` tags)
   - Restore "Create Event" button to primary style (solid blue background)

3. **Revert the About page** (`src/app/(public)/about/page.tsx`):
   - Remove the "Streaming Tech Sweden 2026" section

4. **Delete this README section**

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.
