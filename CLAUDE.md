Never restart a service on OSC by MCP. Ask the user to restart it manually.

## Database Environments

- **Dev database (local development):** `postgresql://openevents:OpenEventsDev2026!@172.232.137.101:10533/openevents` (OSC instance: `sttveventsdev`)
- **Prod database:** `postgresql://openevents:OpenEvents2026!@172.232.131.169:10596/openevents` (OSC instance: `sttveventsdb2`)

The local `.env` should always point to the **dev** database. Never run `prisma migrate dev` against production.

### Migration workflow

1. Develop and run `prisma migrate dev` locally — this targets the dev database
2. When deploying to production, migrations must be applied separately with:
   ```
   DATABASE_URL="postgresql://openevents:OpenEvents2026!@172.232.131.169:10596/openevents" npx prisma migrate deploy
   ```
3. `migrate deploy` only applies pending migrations — it will not create new ones or modify the schema
4. Always apply production migrations **after** the updated app code is deployed, to avoid schema/code mismatches

## Build-time constraints

All pages that call Prisma must export `export const dynamic = 'force-dynamic'` to prevent Next.js from attempting static generation at build time. DATABASE_URL is only available at runtime on OSC.
