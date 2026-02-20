# OpenEvents Architecture

OpenEvents is an open-source event management and ticketing platform built with modern web technologies and deployed on Eyevinn Open Source Cloud (OSC).

## Tech Stack Overview

### Frontend
- **Framework:** Next.js 14+ with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Radix UI primitives with custom styling
- **State Management:** React Server Components + Client State where needed
- **Forms:** React Hook Form + Zod validation

### Backend
- **Runtime:** Node.js (via Next.js API routes and Server Actions)
- **ORM:** Prisma
- **Authentication:** NextAuth.js v4
- **Validation:** Zod

### Database
- **Primary Database:** PostgreSQL (hosted on OSC)
- **Cache/Sessions:** Valkey (Redis-compatible, hosted on OSC)

### Storage
- **Object Storage:** MinIO (S3-compatible, hosted on OSC)
- **Use Cases:** Event images, videos, speaker photos, organizer logos

### Email
- **Development:** MailSlurper (local SMTP capture)
- **Production:** Configure your preferred transactional email provider (SendGrid, Postmark, etc.)

### Deployment
- **Platform:** Eyevinn Open Source Cloud (OSC)
- **Runtime:** Web Runner (eyevinn-web-runner)

## Architecture Decisions

### 1. Monorepo with Next.js App Router

**Decision:** Single Next.js application handling both frontend and API.

**Rationale:**
- Simplified deployment to OSC Web Runner
- Shared types between frontend and backend
- Server Components reduce client-side JavaScript
- API routes colocated with related pages
- Easier for 4 developers to work on without complex service boundaries

### 2. PostgreSQL as Primary Database

**Decision:** PostgreSQL via OSC's `birme-osc-postgresql` service.

**Rationale:**
- Strong consistency for ticket sales (prevents overselling)
- Rich query capabilities for event search and filtering
- JSONB support for flexible data (social links, settings)
- Prisma provides excellent PostgreSQL support

### 3. Valkey for Caching

**Decision:** Valkey (Redis-compatible) via OSC's `valkey-io-valkey` service.

**Rationale:**
- Session storage for scalability
- Rate limiting for API protection
- Temporary ticket holds during checkout
- Event listing cache for performance

### 4. MinIO for Object Storage

**Decision:** MinIO via OSC's `minio-minio` service.

**Rationale:**
- S3-compatible API (portable)
- Direct-to-storage uploads via presigned URLs
- Cost-effective for media files
- Easy integration with AWS SDK

### 5. JWT Sessions with NextAuth

**Decision:** JWT-based sessions instead of database sessions.

**Rationale:**
- Stateless authentication scales better
- No database lookup on every request
- Works well with Valkey for token blacklisting if needed
- Simpler OSC deployment

### 6. Stub Payment Implementation

**Decision:** Mock PayPal integration with real order flow.

**Rationale:**
- Complete checkout UX for testing
- Easy to swap in real PayPal when ready
- Invoice and free ticket flows work immediately

### 7. PDF Ticket Generation

**Decision:** Server-side PDF generation for downloadable tickets.

**Rationale:**
- Printable tickets for attendees
- QR codes for event check-in
- Works offline once downloaded

## OSC Infrastructure

### Provisioned Services

| Service | OSC Service ID | Instance Name | Purpose |
|---------|---------------|---------------|---------|
| PostgreSQL | birme-osc-postgresql | openeventsdb | Primary database |
| MinIO | minio-minio | openeventstorage | Media storage |
| Valkey | valkey-io-valkey | openeventsredis | Cache/Sessions |
| Web Runner | eyevinn-web-runner | openevents | Application hosting |

### Service URLs

```
PostgreSQL: postgres://USER:PASSWORD@HOST:PORT/DATABASE
MinIO: https://YOUR-MINIO-ENDPOINT
Valkey: redis://:PASSWORD@HOST:PORT
```

## Project Structure

```
openevents/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Authentication pages
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── verify-email/
│   │   │   ├── forgot-password/
│   │   │   └── reset-password/
│   │   ├── (public)/          # Public pages
│   │   │   ├── events/        # Event browsing & details
│   │   │   │   └── [slug]/
│   │   │   │       └── checkout/  # Ticket checkout
│   │   │   ├── orders/        # Order confirmation
│   │   │   └── create-event/  # Quick event creation
│   │   ├── (dashboard)/       # User dashboard
│   │   │   └── dashboard/
│   │   │       ├── events/    # Organizer event management
│   │   │       │   ├── new/   # Create new event
│   │   │       │   └── [id]/edit/  # Edit event
│   │   │       ├── orders/    # User orders
│   │   │       └── settings/  # User settings
│   │   ├── (admin)/           # Super admin panel
│   │   │   └── admin/
│   │   │       ├── users/
│   │   │       ├── events/
│   │   │       └── settings/
│   │   └── api/               # API routes
│   │       ├── auth/          # NextAuth routes
│   │       ├── events/        # Event CRUD
│   │       ├── events/[id]/
│   │       │   ├── ticket-types/  # Ticket management
│   │       │   └── discount-codes/  # Discount codes
│   │       ├── orders/        # Order processing
│   │       ├── discount-codes/  # Discount validation
│   │       ├── users/         # User management
│   │       ├── admin/         # Admin endpoints
│   │       └── upload/        # File upload presigned URLs
│   ├── components/            # React components
│   │   ├── ui/                # Base UI components
│   │   ├── auth/              # Auth-specific components
│   │   ├── events/            # Event components
│   │   ├── tickets/           # Ticket components
│   │   ├── dashboard/         # Dashboard components
│   │   ├── admin/             # Admin components
│   │   └── layout/            # Layout components
│   ├── lib/                   # Shared libraries
│   │   ├── auth/              # Authentication utilities
│   │   ├── db/                # Database client (Prisma)
│   │   ├── email/             # Email service
│   │   ├── storage/           # S3/MinIO utilities
│   │   ├── payments/          # Payment service (stub)
│   │   ├── utils/             # General utilities
│   │   └── validations/       # Zod schemas
│   └── types/                 # TypeScript types
├── public/                    # Static assets
├── docs/                      # Additional documentation
└── [config files]             # Next.js, TypeScript, etc.
```

## Data Model

### Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐
│      User       │       │    UserRole     │
├─────────────────┤       ├─────────────────┤
│ id              │───┐   │ id              │
│ email           │   │   │ userId          │───┐
│ passwordHash    │   └──>│ role            │   │
│ firstName       │       │ grantedAt       │   │
│ lastName        │       └─────────────────┘   │
│ emailVerified   │                             │
└─────────────────┘<────────────────────────────┘
        │
        │ 1:1
        v
┌─────────────────┐       ┌─────────────────┐
│OrganizerProfile │       │     Event       │
├─────────────────┤       ├─────────────────┤
│ id              │──────>│ id              │
│ userId          │       │ organizerId     │
│ orgName         │       │ title           │
│ description     │       │ slug            │
│ logo            │       │ description     │
└─────────────────┘       │ startDate       │
                          │ endDate         │
                          │ status          │
                          │ visibility      │
                          └─────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        v                         v                         v
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   TicketType    │       │  DiscountCode   │       │     Order       │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │       │ id              │
│ eventId         │       │ eventId         │       │ eventId         │
│ name            │       │ code            │       │ userId          │
│ price           │       │ discountType    │       │ buyerInfo...    │
│ maxCapacity     │       │ discountValue   │       │ totalAmount     │
│ soldCount       │       │ maxUses         │       │ status          │
└─────────────────┘       └─────────────────┘       │ paymentMethod   │
        │                         │                 └─────────────────┘
        │                         │                         │
        └─────────────────────────┴─────────────────────────┤
                                                            │
                                                            v
                                                    ┌─────────────────┐
                                                    │     Ticket      │
                                                    ├─────────────────┤
                                                    │ id              │
                                                    │ ticketCode      │
                                                    │ orderId         │
                                                    │ status          │
                                                    └─────────────────┘
```

### Key Models

1. **User** - Platform users with email/password or OAuth
2. **UserRole** - Role assignments (ATTENDEE, ORGANIZER, SUPER_ADMIN)
3. **OrganizerProfile** - Extended profile for event organizers
4. **Event** - Event details with location, dates, visibility
5. **TicketType** - Ticket tiers with pricing and capacity
6. **DiscountCode** - Promotional codes with various discount types
7. **Order** - Purchase records with buyer information
8. **Ticket** - Individual tickets generated from orders

## Security Considerations

### Authentication
- Passwords hashed with bcrypt (cost factor 12)
- JWT tokens with short expiry (30 days)
- Email verification required for password auth
- OAuth auto-verifies email

### Authorization
- Role-based access control (RBAC)
- Middleware checks on protected routes
- API routes validate user roles
- Organizers can only manage their own events

### Data Protection
- Input validation with Zod on all endpoints
- Parameterized queries via Prisma (SQL injection prevention)
- CSRF protection via NextAuth
- Secure cookie settings in production

### Capacity Management
- Database-level constraints prevent overselling
- Pessimistic locking during ticket purchase
- Reserved count for in-progress checkouts

## Deployment Process

1. Push code to GitHub repository
2. OSC Web Runner pulls from GitHub
3. Automatic build and deployment
4. Environment variables configured in OSC

See `CONTRIBUTING.md` for detailed deployment instructions.

## Future Enhancements

### Phase 2 (In Progress)
- PayPal live integration
- Automated refund processing
- Webhook handling for payment events
- Organizer dashboard statistics
- Admin panel for platform management

### Phase 3
- Multi-currency support
- Mobile-responsive improvements
- Email templates customization

### Phase 4
- Analytics dashboard
- Attendee check-in app
- Calendar integrations
