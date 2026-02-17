# Developer Onboarding Guide

## Prerequisites
- Node.js 18+
- Git

## Setup

```bash
# 1. Clone the repository
git clone https://github.com/JuiceAndTheJoe/openevents.git
cd openevents

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env

# 4. Generate Prisma client
npm run db:generate
```

## Local Development (Optional)

If you want to run the app locally for testing:
```bash
npm run dev
```
The app will be available at http://localhost:3000

This is **optional** - you can also test directly on the deployed app.

## Deploying Changes

To deploy your changes to the live app:

1. **Commit and push** your changes to the repo
2. **Restart the OSC Web Runner** (openeventsapp) to pull the latest code

The deployed app is live at https://lm2yqccxwl.apps.osaas.io

## Important Notes

- **No migrations needed** - The database is already set up on OSC
- **Credentials are pre-configured** - `.env.example` contains the real OSC credentials
- **Shared infrastructure** - We all connect to the same PostgreSQL, MinIO, and Valkey instances on OSC
- **OSC handles builds** - No need to run `npm run build` locally

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server (optional) |
| `npm run db:generate` | Regenerate Prisma client (after schema changes) |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
