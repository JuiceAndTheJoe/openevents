# Contributing to OpenEvents

Welcome to OpenEvents! This guide will help you get started with development and contribute to the project.

## Prerequisites

- Node.js 18+
- npm 9+
- Git
- Access to OSC services (credentials in `.env`)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
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

feat(auth): add Google OAuth login
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
- User registration and login
- OAuth integration (Google, GitHub)
- Email verification
- Password reset
- Role management
- **Key files:** `src/app/(auth)/`, `src/lib/auth/`, `src/app/api/auth/`

### Events Agent
- Event CRUD operations
- Media uploads (images, videos)
- Agenda and speakers management
- Categories and search
- **Key files:** `src/app/(public)/events/`, `src/app/(dashboard)/dashboard/events/`, `src/app/api/events/`

### Tickets Agent
- Ticket type management
- Discount codes
- Order processing
- Capacity management
- **Key files:** `src/app/api/tickets/`, `src/app/api/orders/`, ticket-related components

### Org Admin Panel Agent
- Organizer dashboard
- Event statistics
- Order management for organizers
- Settings and profile
- **Key files:** `src/app/(dashboard)/dashboard/`, `src/components/dashboard/`

## Database Changes

### Creating Migrations

When you modify `prisma/schema.prisma`:

```bash
# Create a migration
npx prisma migrate dev --name describe_your_change

# Example
npx prisma migrate dev --name add_ticket_sales_dates
```

### Viewing the Database

```bash
# Open Prisma Studio
npx prisma studio
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- path/to/test.ts
```

### Writing Tests

- Place tests next to the code they test (`*.test.ts`)
- Or in `__tests__` directories
- Use descriptive test names

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

### Automatic Deployment

When you push to the `main` branch:

1. OSC Web Runner detects the update
2. Pulls the latest code from GitHub
3. Runs `npm install` and `npm run build`
4. Restarts the application

### Manual Deployment

If needed, you can trigger a restart via OSC:

```bash
# Using OSC CLI
npx @osaas/cli restart eyevinn-web-runner openevents
```

### Environment Variables in OSC

Environment variables are configured through OSC's Web Runner service. Contact the project admin to update production variables.

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
- Check `TASKS.md` for current work items

## License

This project is open source under the MIT License.
