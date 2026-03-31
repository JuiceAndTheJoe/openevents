-- Combined migration: Remove Category system, OrganizerRequest, and ATTENDEE role
-- Part of single-tenant simplification

-- 1. Category system removal
DROP TABLE IF EXISTS "event_categories";
DROP TABLE IF EXISTS "categories";

-- 2. OrganizerRequest removal
DROP TABLE IF EXISTS "organizer_requests";
DROP TYPE IF EXISTS "OrganizerRequestStatus";

-- 3. ATTENDEE role removal
-- 3a. Promote ATTENDEE-only users to ORGANIZER before removing the role
INSERT INTO "user_roles" ("id", "userId", "role", "grantedAt")
SELECT
  gen_random_uuid(),
  ur."userId",
  'ORGANIZER',
  NOW()
FROM "user_roles" ur
WHERE ur."role" = 'ATTENDEE'
  AND NOT EXISTS (
    SELECT 1 FROM "user_roles" ur2
    WHERE ur2."userId" = ur."userId"
      AND ur2."role" IN ('ORGANIZER', 'SUPER_ADMIN')
  )
ON CONFLICT ("userId", "role") DO NOTHING;

-- 3b. Delete all ATTENDEE role assignments
DELETE FROM "user_roles" WHERE "role" = 'ATTENDEE';

-- 3c. Alter the Role enum (Postgres requires rename-recreate pattern)
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('ORGANIZER', 'SUPER_ADMIN');
ALTER TABLE "user_roles" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
DROP TYPE "Role_old";
