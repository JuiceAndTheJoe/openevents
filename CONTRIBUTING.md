# Contributing to OpenEvents

Welcome to OpenEvents! This guide will help you contribute to the project hosted at [github.com/JuiceAndTheJoe/openevents](https://github.com/JuiceAndTheJoe/openevents), which powers the live deployment at [events.apps.osaas.io](https://events.apps.osaas.io).

> **Want your own instance instead?** If you want to deploy a separate OpenEvents instance for your own events, see [Option 2: Deploy Your Own Instance](./README.md#option-2-deploy-your-own-instance) in the README.

## Prerequisites

- Node.js 18+
- npm 9+
- Git
- Access to OSC services (credentials in `.env`)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/JuiceAndTheJoe/openevents.git
cd openevents
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file and fill in the values:

```bash
cp .env.example .env
```

See `.env.example` for all required variables and their descriptions.

### 4. Set Up the Database

Generate Prisma client and run migrations:

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (creates tables)
npx prisma migrate dev

# Seed the database (optional)
npx prisma db seed
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:

- `feature/` - New features (e.g., `feature/event-search`)
- `fix/` - Bug fixes (e.g., `fix/ticket-capacity`)
- `refactor/` - Code refactoring
- `docs/` - Documentation updates
- `agent/` - Agent-specific work (e.g., `agent/auth-oauth`)

### Commit Messages

Follow conventional commits:

```
type(scope): description

feat(auth): add password strength validation
fix(tickets): prevent overselling when capacity reached
docs(readme): update deployment instructions
```

### Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Run tests and linting: `npm run lint`
4. Push your branch
5. Create a Pull Request with a clear description
6. Request review from relevant team members

## Project Structure Overview

```
src/
├── app/              # Next.js App Router (pages & API routes)
├── components/       # React components
├── lib/              # Shared utilities and services
├── types/            # TypeScript type definitions
```

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/app/(auth)/` | Authentication pages (login, register, etc.) |
| `src/app/(public)/` | Public-facing pages (event listing, details) |
| `src/app/(dashboard)/` | User/Organizer dashboard |
| `src/app/(admin)/` | Super Admin panel |
| `src/app/api/` | API routes |
| `src/lib/auth/` | Authentication utilities |
| `src/lib/db/` | Database client |
| `src/lib/validations/` | Zod validation schemas |

## Agent Responsibilities

The project is divided among 4 feature agents. Each agent owns a vertical slice:

### Auth Agent
- Organizer registration and login
- Password reset
- Role management (Organizer, Super Admin)
- **Key files:** `src/app/(auth)/`, `src/lib/auth/`, `src/app/api/auth/`
- **Note:** Attendees don't have accounts—they purchase tickets via guest checkout

### Events Agent
- Event CRUD operations
- Media uploads (images, videos)
- Agenda and speakers management
- Categories and search
- Event publishing/cancellation
- **Key files:** `src/app/(public)/events/`, `src/app/(public)/create-event/`, `src/app/(dashboard)/dashboard/events/`, `src/app/api/events/`

### Tickets Agent
- Ticket type management
- Discount codes
- Order processing & checkout flow
- Capacity management & oversell prevention
- PDF ticket generation
- Order confirmation & cancellation
- **Key files:** `src/app/api/events/[id]/ticket-types/`, `src/app/api/orders/`, `src/app/(public)/events/[slug]/checkout/`, ticket-related components

### Org Admin Panel Agent
- Organizer dashboard
- Event statistics
- Order management for organizers
- Settings and profile
- **Key files:** `src/app/(dashboard)/dashboard/`, `src/components/dashboard/`

## Database Changes

### Dev vs Production Databases

Local development uses a **separate dev database** to avoid accidentally running migrations against production. Your `.env` should point to the dev database — see `.env.example` for details.

| Environment | OSC Instance | Host |
|-------------|-------------|------|
| Development | `sttveventsdev` | `172.232.137.101:10533` |
| Production | `sttveventsdb2` | `172.232.131.169:10596` |

> **Warning:** Never run `prisma migrate dev` with `DATABASE_URL` pointing to the production database. `migrate dev` can create and apply migrations, reset data, and drop tables — it is designed for development only.

### Creating Migrations

When you modify `prisma/schema.prisma`:

```bash
# Create and apply a migration to your local dev database
npx prisma migrate dev --name describe_your_change

# Example
npx prisma migrate dev --name add_ticket_sales_dates
```

### Applying Migrations to Production

After your code changes are deployed (e.g., PR merged and app restarted on OSC), apply pending migrations to the production database:

```bash
DATABASE_URL="<production-connection-string>" npx prisma migrate deploy
```

`migrate deploy` only applies pending migrations — it will not generate new ones or modify the schema. Always deploy the app code **before** running production migrations to avoid schema/code mismatches.

### Build-time Database Access

Pages that make Prisma calls must include `export const dynamic = 'force-dynamic'` to prevent Next.js from attempting static generation at build time. On OSC, `DATABASE_URL` is only available at runtime, so any page that queries the database during static generation will fail the build.

### Viewing the Database

```bash
# Open Prisma Studio
npx prisma studio
```

## Testing

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run a specific test file
npm test -- src/__tests__/lib/auth/config.test.ts

# Run tests matching a pattern
npm test -- --grep "authorize"
```

### Test Structure

Tests are located in `src/__tests__/` and organized by module:

```
src/__tests__/
└── lib/
    ├── auth/
    │   └── config.test.ts    # Auth callback tests (authorize, signIn, jwt, session)
    ├── discountUsage.test.ts # Discount code usage tracking
    ├── orders.test.ts        # Order processing logic
    └── tickets.test.ts       # Ticket calculations and validations
```

### Writing Tests

- Place tests in `src/__tests__/` mirroring the source structure
- Use Vitest as the test runner (`describe`, `it`, `expect`)
- Mock external dependencies (database, APIs) - no real DB calls in tests
- Use descriptive test names that explain the expected behavior

Example test structure:
```typescript
import { describe, it, expect, vi } from 'vitest'

describe('MyFunction', () => {
  it('returns expected value when given valid input', () => {
    expect(myFunction('input')).toBe('expected')
  })

  it('throws error when input is invalid', () => {
    expect(() => myFunction(null)).toThrow('Invalid input')
  })
})
```

## Code Style

### TypeScript

- Use strict mode (enabled by default)
- Prefer explicit types over `any`
- Use Zod for runtime validation

### React

- Prefer Server Components when possible
- Use `'use client'` directive only when needed
- Keep components small and focused

### Formatting

The project uses ESLint for linting:

```bash
# Run linter
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

## Environment Variables

See `.env.example` for the complete list. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Secret for JWT signing |
| `S3_ENDPOINT` | MinIO/S3 endpoint URL |
| `SMTP_HOST` | Email server host |

## Deployment to OSC

The live deployment at [events.apps.osaas.io](https://events.apps.osaas.io) runs on Eyevinn Open Source Cloud.

### Deploying Changes

Changes merged to `main` require a **manual restart** of the Web Runner instance to go live. When restarted, OSC will:

1. Pull the latest code from GitHub
2. Run `npm install` and `npm run build`
3. Start the updated application

**For the main deployment (events.apps.osaas.io):** Contact the project maintainers to trigger a restart after your PR is merged.

**For your own instance:** Restart your Web Runner through your OSC account to deploy changes pushed to your fork.

### Environment Variables in OSC

Environment variables for the production deployment are configured through OSC's Web Runner service. Contact the project maintainers to update production variables.

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
npx prisma db pull

# Reset database (CAUTION: deletes data)
npx prisma migrate reset
```

### Prisma Client Issues

```bash
# Regenerate client
npx prisma generate
```

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

## Getting Help

- Check existing issues in the repository
- Ask in the team Slack/Discord channel
- Review the `ARCHITECTURE.md` for system design questions

## License

This project is open source under the MIT License.
