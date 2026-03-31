# OpenEvents Single-Tenant Simplification Plan

## Executive Summary

This plan converts OpenEvents from a multi-tenant platform to a single-tenant per-user instance model by executing 6 features across 3 parallel work streams, followed by a unified migration phase.

**Total scope:** ~60 files modified/deleted, 1 new component, 1 combined migration.

---

## Dependency Graph

```
                    PHASE 1 (parallel)                    PHASE 2 (sequential)
                    ==================                    ====================

  Stream A          Stream B            Stream C          Shared File Merge
  --------          --------            --------          -----------------
  F3: OrgReq        F5: Multi-Org       F6: Showcase UI   schema.prisma
  F4: ATTENDEE      (30+ files)         (5 files)         seed.ts
  (12 files)                                              page.tsx (home)
                                                          events/page.tsx
                                                          api/events/route.ts
                                                          EventList.tsx
                                                          dashboard-analytics.ts
                                                          SalesChart.tsx

                              PHASE 3 (after merge)
                              =====================
                              F1: Categories (17+ files)
                              F2: Search/Filter (5 files)
```

---

## Phase 1: Three Parallel Work Streams

### Stream A: Auth & Role Cleanup (Features 3 + 4)

**No overlap with Streams B or C.** These features touch auth, admin user management, and schema -- all files unique to this stream within Phase 1.

#### Feature 3: Remove OrganizerRequest Flow

| Action | File | Details |
|--------|------|---------|
| DELETE | `src/app/api/users/request-organizer/route.ts` | Entire file |
| DELETE | `src/app/api/admin/organizer-requests/route.ts` | Entire file |
| DELETE | `src/app/api/admin/organizer-requests/[id]/route.ts` | Entire file |
| MODIFY | `src/app/api/auth/register/route.ts` | Remove 2 stale comments referencing organizer requests |
| STAGE  | `prisma/schema.prisma` | Remove `OrganizerRequest` model and `OrganizerRequestStatus` enum (lines 138-157). **Do not apply migration yet -- hold for Phase 2.** |

**Risk:** Minimal. No UI pages depend on this. Clean deletion.

#### Feature 4: Remove ATTENDEE Role

| Action | File | Details |
|--------|------|---------|
| MODIFY | `prisma/schema.prisma` | Remove `ATTENDEE` from `Role` enum (line 120). **Hold for combined migration.** |
| MODIFY | `prisma/seed.ts` | Remove any ATTENDEE role assignments |
| MODIFY | `src/lib/auth/index.ts` | Delete `isAttendee()` function (~line 98-99) |
| MODIFY | `src/lib/auth/config.ts` | Remove `events.createUser` callback that assigns ATTENDEE role (~lines 255-259) |
| MODIFY | `src/app/api/auth/register/route.ts` | Remove ATTENDEE role assignment in registration flow |
| MODIFY | `src/app/api/admin/users/route.ts` | Remove ATTENDEE from Zod schema and POST handler |
| MODIFY | `src/app/api/admin/users/[id]/role/route.ts` | Rewrite `resolveTargetRoles` to exclude ATTENDEE |
| MODIFY | `src/app/(dashboard)/dashboard/admin/users/page.tsx` | Remove "Regular Users" filter tab |
| MODIFY | `src/components/dashboard/CreateUserForm.tsx` | Remove ATTENDEE option from role selection |
| MODIFY | `src/components/dashboard/UsersTable.tsx` | Remove ATTENDEE option, update `resolveAccountType` fallthrough |
| MODIFY | `src/lib/auth/__tests__/config.test.ts` | Update 17+ ATTENDEE references in tests |

**Risk: HIGH.** Users who currently have ONLY the ATTENDEE role will become role-less after migration.

**Mitigation:** The migration SQL must first assign ORGANIZER role to any user who only has ATTENDEE, then remove all ATTENDEE role rows, then alter the enum. See Migration Strategy below.

---

### Stream B: Remove Multi-Org Scoping (Feature 5)

**Touches ~30 files, none overlapping with Stream A. Two files overlap with Streams handling Features 1/6 (`dashboard-analytics.ts`, `SalesChart.tsx`) -- but those features run in Phase 3, so no conflict.**

Core change: `buildEventWhereClause()` in `src/lib/dashboard/organizer.ts` stops filtering by `organizerId`. All ORGANIZER users see all events (single-tenant = one org).

| Action | File | Details |
|--------|------|---------|
| MODIFY | `src/lib/dashboard/organizer.ts` | Simplify `buildEventWhereClause()`: remove the `if (!isSuperAdmin)` organizerId filter. `canAccessEvent()` no longer needs ownership check. |
| MODIFY | `src/app/(dashboard)/dashboard/page.tsx` | Remove 3 ternaries checking organizerProfile; always show full dashboard |
| MODIFY | `src/app/(dashboard)/dashboard/events/page.tsx` | Remove organizerId-based filtering |
| MODIFY | `src/app/(dashboard)/dashboard/admin/page.tsx` | Remove org-scoped analytics |
| MODIFY | `src/components/dashboard/Sidebar.tsx` (or nav component) | Always show "Manage Events" link |
| MODIFY | `src/lib/analytics/dashboard-analytics.ts` | Remove `organizerId` parameter from analytics functions |
| MODIFY | `src/components/dashboard/SalesChart.tsx` | Remove organizerId parameter |
| MODIFY | `src/app/api/events/[id]/statistics/route.ts` | Remove organizerId parameter |
| MODIFY | `src/app/api/dashboard/events/[id]/attendees/export/route.ts` | Remove per-user organizer match, use role check |
| MODIFY | `src/app/api/dashboard/events/[id]/attendees/export-excel/route.ts` | Same as above |
| MODIFY | `src/app/(dashboard)/dashboard/events/[id]/page.tsx` | Simplify canAccessEvent usage |
| MODIFY | `src/app/(dashboard)/dashboard/events/[id]/edit/page.tsx` | Simplify canAccessEvent usage |
| MODIFY | `src/app/(dashboard)/dashboard/events/[id]/orders/page.tsx` | Simplify canAccessEvent / inline ternaries |
| MODIFY | `src/app/(dashboard)/dashboard/events/[id]/orders/new/page.tsx` | Simplify canAccessEvent usage |
| MODIFY | `src/app/(dashboard)/dashboard/events/[id]/orders/[orderId]/page.tsx` | Simplify canAccessEvent usage |
| MODIFY | `src/app/(dashboard)/dashboard/events/[id]/tickets/page.tsx` | Simplify canAccessEvent usage |
| MODIFY | `src/app/(dashboard)/dashboard/events/[id]/discounts/page.tsx` | Simplify canAccessEvent usage |
| MODIFY | `src/app/(dashboard)/dashboard/events/[id]/scan/page.tsx` | Simplify canAccessEvent usage |
| MODIFY | `src/app/(dashboard)/dashboard/scan/page.tsx` | Replace organizer profile match with role check |
| EVALUATE | `src/app/api/admin/events/export/` | Potentially dead code -- evaluate and delete if unused |
| EVALUATE | `src/app/api/admin/events/bulk-unpublish/` | Potentially dead code -- evaluate and delete if unused |
| MODIFY | Event mutation API routes (8 routes under `src/app/api/events/[id]/`) | Replace `organizer.userId !== user.id` guards with role-based checks |
| MODIFY | Orders API routes | Replace per-user organizer match with role check |
| MODIFY | Ticket verification API | Replace organizer profile match with role check |

**Risk: MEDIUM.** `canAccessEvent()` is used in server actions where `organizerProfile` can be null. After removing the org filter, ensure no null reference on `organizerProfile` in downstream code. Review every call site of `canAccessEvent()` and `requireOrganizerProfile()`.

**Mitigation:** After simplifying `buildEventWhereClause`, grep all 14 call sites and verify none dereference `organizerProfile.id` without a null check.

---

### Stream C: Showcase UI Redesign (Feature 6)

**Creates a new component and modifies EventList.tsx, homepage, and events page -- but these overlap with Features 1 and 2. Within Phase 1, Stream C prepares the new component only. The integration into shared pages happens in Phase 3.**

| Action | File | Details |
|--------|------|---------|
| CREATE | `src/components/events/ShowcaseEventCard.tsx` | Hero-style card with gradient overlay, CTA button. Uses brand color `#5C8BD9`, Outfit font, lucide icons, `rounded-2xl`. |
| MODIFY | `src/components/events/EventList.tsx` | Add `layout` prop (`'grid' \| 'showcase'`), branching logic for 1/2/3+ events. **This file also changes in Feature 1 -- coordinate in Phase 3.** |

**Note:** The homepage (`src/app/page.tsx`) and events page (`src/app/(public)/events/page.tsx`) changes from Feature 6 MUST be deferred to Phase 3 because they overlap with Features 1 and 2.

---

## Phase 2: Combined Database Migration

**Execute AFTER all Phase 1 code changes are complete and tested.**

All three schema changes (Features 1, 3, 4) are combined into a single Prisma migration to avoid migration ordering issues.

### Migration SQL (single file)

```sql
-- ============================================================
-- Combined migration: Remove Category, OrganizerRequest, ATTENDEE
-- ============================================================

-- 1. Category system removal
DROP TABLE IF EXISTS "event_categories";
DROP TABLE IF EXISTS "categories";

-- 2. OrganizerRequest removal
DROP TABLE IF EXISTS "organizer_requests";
DROP TYPE IF EXISTS "OrganizerRequestStatus";

-- 3. ATTENDEE role removal (order matters!)
-- 3a. Promote ATTENDEE-only users to ORGANIZER
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
ALTER TABLE "user_roles" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
DROP TYPE "Role_old";
```

### Prisma Schema (final state after migration)

Remove from `prisma/schema.prisma`:
- `Category` model (lines 284-294)
- `EventCategory` model (lines 296-305)
- `categories EventCategory[]` relation on `Event` model (line 231)
- `OrganizerRequest` model (lines 138-151)
- `OrganizerRequestStatus` enum (lines 153-157)
- `ATTENDEE` from `Role` enum (line 120)

### How to apply

```bash
# 1. Create migration file manually
npx prisma migrate dev --create-only --name remove_categories_orgrequests_attendee

# 2. Replace the generated SQL with the combined migration above

# 3. Apply
npx prisma migrate dev

# 4. Regenerate client
npx prisma generate
```

---

## Phase 3: Shared File Integration (Sequential)

**Must run AFTER Phases 1 and 2.** These files are touched by multiple features and must be edited in a single pass.

### 3A: Features 1 + 2 + 6 on public pages

These three features converge on the same files. Execute as a single unit.

| File | Feature 1 Changes | Feature 2 Changes | Feature 6 Changes |
|------|-------------------|-------------------|-------------------|
| `src/app/page.tsx` | Remove categories query | Remove HeroSearchBar import/usage | Switch to showcase layout, fetch more events |
| `src/app/(public)/events/page.tsx` | Remove category filter params | Remove filter params, simplify `$transaction` (3-element to 2-element), remove EventFilters import | Use showcase layout, keep pagination |
| `src/app/api/events/route.ts` | Remove category include/filter in GET, remove category handling in POST | Remove search/filter logic (search, category, location, dateRange params) | No changes |
| `src/components/events/EventList.tsx` | Remove category badge/display | No changes | Add layout prop, showcase branching logic |

### 3B: Features 1 + 5 on analytics

| File | Feature 1 Changes | Feature 5 Changes |
|------|-------------------|-------------------|
| `src/lib/analytics/dashboard-analytics.ts` | Remove category-related analytics queries | Remove organizerId parameter (already done in Phase 1 if Stream B completed) |
| `src/components/dashboard/SalesChart.tsx` | Remove category breakdown | Remove organizerId parameter (already done in Phase 1 if Stream B completed) |

**Execution note:** If Stream B (Feature 5) completed in Phase 1, these files already had the organizerId removal applied. Phase 3 only needs to layer on the Feature 1 category removal.

### 3C: Remaining Feature 1 files (no overlap)

| Action | File | Details |
|--------|------|---------|
| MODIFY | `src/components/events/EventForm.tsx` | Remove ~25 category touch points: category state, validation pipeline, publish guards, category selector UI, form submission. **This is the highest-risk file -- 3800 lines with categories woven into validation.** |
| MODIFY | `src/components/events/CreateEventForm.tsx` | Remove category selection/passing |
| MODIFY | `src/app/api/events/[id]/route.ts` (PATCH) | Remove category update logic |
| MODIFY | `prisma/seed.ts` | Remove category seed data, remove ATTENDEE references (if not done in Phase 1) |

### 3D: Remaining Feature 2 files (no overlap)

| Action | File | Details |
|--------|------|---------|
| DELETE | `src/components/events/HeroSearchBar.tsx` | Entire file |
| DELETE | `src/components/events/EventFilters.tsx` | Entire file |

---

## Complete File Inventory

### Files to DELETE (7 files)

| File | Feature |
|------|---------|
| `src/app/api/users/request-organizer/route.ts` | F3 |
| `src/app/api/admin/organizer-requests/route.ts` | F3 |
| `src/app/api/admin/organizer-requests/[id]/route.ts` | F3 |
| `src/components/events/HeroSearchBar.tsx` | F2 |
| `src/components/events/EventFilters.tsx` | F2 |
| `src/app/api/admin/events/export/route.ts` | F5 (if confirmed dead) |
| `src/app/api/admin/events/bulk-unpublish/route.ts` | F5 (if confirmed dead) |

### Files to CREATE (1 file)

| File | Feature |
|------|---------|
| `src/components/events/ShowcaseEventCard.tsx` | F6 |

### Files to MODIFY (~50 files)

#### Schema & Seed (Phase 2)
- `prisma/schema.prisma` -- F1, F3, F4
- `prisma/seed.ts` -- F1, F4

#### Auth & Admin (Stream A - Phase 1)
- `src/lib/auth/index.ts` -- F4
- `src/lib/auth/config.ts` -- F4
- `src/lib/auth/__tests__/config.test.ts` -- F4
- `src/app/api/auth/register/route.ts` -- F3, F4
- `src/app/api/admin/users/route.ts` -- F4
- `src/app/api/admin/users/[id]/role/route.ts` -- F4
- `src/app/(dashboard)/dashboard/admin/users/page.tsx` -- F4

#### Dashboard UI & Components (Stream A - Phase 1)
- `src/components/dashboard/CreateUserForm.tsx` -- F4
- `src/components/dashboard/UsersTable.tsx` -- F4

#### Multi-Org Scoping (Stream B - Phase 1)
- `src/lib/dashboard/organizer.ts` -- F5
- `src/app/(dashboard)/dashboard/page.tsx` -- F5
- `src/app/(dashboard)/dashboard/events/page.tsx` -- F5
- `src/app/(dashboard)/dashboard/admin/page.tsx` -- F5
- `src/components/dashboard/Sidebar.tsx` (or equivalent nav) -- F5
- `src/app/api/events/[id]/statistics/route.ts` -- F5
- `src/app/api/dashboard/events/[id]/attendees/export/route.ts` -- F5
- `src/app/api/dashboard/events/[id]/attendees/export-excel/route.ts` -- F5
- `src/app/(dashboard)/dashboard/events/[id]/page.tsx` -- F5
- `src/app/(dashboard)/dashboard/events/[id]/edit/page.tsx` -- F5
- `src/app/(dashboard)/dashboard/events/[id]/orders/page.tsx` -- F5
- `src/app/(dashboard)/dashboard/events/[id]/orders/new/page.tsx` -- F5
- `src/app/(dashboard)/dashboard/events/[id]/orders/[orderId]/page.tsx` -- F5
- `src/app/(dashboard)/dashboard/events/[id]/tickets/page.tsx` -- F5
- `src/app/(dashboard)/dashboard/events/[id]/discounts/page.tsx` -- F5
- `src/app/(dashboard)/dashboard/events/[id]/scan/page.tsx` -- F5
- `src/app/(dashboard)/dashboard/scan/page.tsx` -- F5
- Event mutation API routes (8 routes under `src/app/api/events/[id]/`) -- F5
- Orders API routes -- F5
- Ticket verification API -- F5

#### Shared / Multi-Feature (Phase 3)
- `src/app/page.tsx` -- F1, F2, F6
- `src/app/(public)/events/page.tsx` -- F1, F2, F6
- `src/app/api/events/route.ts` -- F1, F2
- `src/components/events/EventList.tsx` -- F1, F6
- `src/lib/analytics/dashboard-analytics.ts` -- F1, F5
- `src/components/dashboard/SalesChart.tsx` -- F1, F5
- `src/components/events/EventForm.tsx` -- F1
- `src/components/events/CreateEventForm.tsx` -- F1
- `src/app/api/events/[id]/route.ts` -- F1

---

## Critical Risk Register

| # | Risk | Severity | Feature | Mitigation |
|---|------|----------|---------|------------|
| 1 | **ATTENDEE-only users become role-less** | HIGH | F4 | Migration SQL promotes them to ORGANIZER before deleting ATTENDEE rows. Verify with `SELECT COUNT(*) FROM user_roles GROUP BY "userId" HAVING COUNT(*) = 1 AND MAX(role) = 'ATTENDEE'` before migrating. |
| 2 | **EventForm.tsx category removal breaks validation** | HIGH | F1 | Categories are woven into validation pipeline and publish guards across ~25 touch points in a 3800-line file. Must test full event create/edit/publish flow after changes. Approach: search for `category` / `categories` in the file, remove each touch point, then verify form still submits and publishes. |
| 3 | **Null reference on organizerProfile after multi-org removal** | MEDIUM | F5 | After simplifying `buildEventWhereClause`, grep all 14 call sites of `canAccessEvent()` and `requireOrganizerProfile()`. Ensure no code dereferences `organizerProfile.id` without a null check. |
| 4 | **$transaction array size change** | LOW | F2 | Events page `$transaction` changes from 3-element to 2-element tuple. Update destructuring accordingly. TypeScript will catch mismatches at build time. |
| 5 | **Postgres enum migration failure** | MEDIUM | F4 | The rename-recreate pattern for enums can fail if any column still references the old enum. Run migration on a staging DB first. The combined migration handles this by deleting ATTENDEE rows before altering the type. |
| 6 | **Stale type imports** | LOW | F1, F3 | After removing Prisma models, `prisma generate` will update the client. Any file importing `Category`, `EventCategory`, `OrganizerRequest`, or `OrganizerRequestStatus` types will fail at build time -- fix as they surface. |

---

## Execution Checklist

### Pre-flight
- [x] Back up production database
- [x] Run `SELECT COUNT(*) FROM user_roles WHERE role = 'ATTENDEE'` to quantify impact
- [x] Run `npm run build` to establish baseline (should pass)
- [x] Run `npm test` to establish baseline

### Phase 1 (Parallel Streams) — COMPLETED
- [x] **Stream A:** Complete Feature 3 (OrganizerRequest removal) — 3 API route files deleted, register comments updated
- [x] **Stream A:** Complete Feature 4 (ATTENDEE removal -- code only, no migration) — 12 files modified
- [x] **Stream B:** Complete Feature 5 (Multi-Org scoping removal) — 35 files modified, 2 dead code dirs deleted
- [x] **Stream C:** Create `ShowcaseEventCard.tsx` — component created, EventList updated with layout prop

### Phase 2 (Migration) — COMPLETED
- [x] Update `prisma/schema.prisma` with all removals (Category, EventCategory, OrganizerRequest, OrganizerRequestStatus, ATTENDEE)
- [x] Create combined migration manually (shadow DB unavailable due to pre-existing migration issues)
- [x] Migration SQL includes ATTENDEE-only user promotion to ORGANIZER
- [x] Regenerate Prisma client: `npx prisma generate`
- [x] TypeScript compilation passes with 0 errors

### Phase 3 (Shared Files) — COMPLETED
- [x] Edit `src/app/page.tsx` (combine F1 + F2 + F6 changes)
- [x] Edit `src/app/(public)/events/page.tsx` (combine F1 + F2 + F6 changes)
- [x] Edit `src/app/api/events/route.ts` (combine F1 + F2 changes)
- [x] Edit `src/components/events/EventList.tsx` (combine F1 + F6 changes)
- [x] Edit `src/lib/analytics/dashboard-analytics.ts` (F1 category removal, F5 already done)
- [x] Edit `src/components/dashboard/SalesChart.tsx` (F1 category removal, F5 already done)
- [x] Edit `src/components/events/EventForm.tsx` (F1 -- highest risk, ~25 category touch points removed)
- [x] Edit `src/components/events/CreateEventForm.tsx` (F1)
- [x] Edit `src/app/api/events/[id]/route.ts` PATCH handler (F1)
- [x] Edit `prisma/seed.ts` (F1 + F4)
- [x] Delete `src/components/events/HeroSearchBar.tsx` (F2)
- [x] Delete `src/components/events/EventFilters.tsx` (F2)
- [x] `npx tsc --noEmit` — 0 errors
- [x] `npx vitest run` — 80/80 tests passing

### Post-flight — PENDING (manual verification needed)
- [ ] Apply migration to production: `npx prisma migrate deploy`
- [ ] Manual smoke test: create event, edit event, publish event
- [ ] Manual smoke test: homepage renders with showcase layout
- [ ] Manual smoke test: events page renders with pagination, no filters
- [ ] Manual smoke test: admin user management (no ATTENDEE option)
- [ ] Manual smoke test: dashboard shows all events (no org scoping)

### Issues encountered during execution
- Shadow database unavailable for `prisma migrate dev --create-only` due to pre-existing migration history issues. Migration created manually instead.
- Test file `config.test.ts` had pre-existing type issues (`mustChangePassword` missing from mock objects) exposed by the changes. Fixed by adding the field to all mock objects.

---

## Time Estimate

| Phase | Estimated Time | Parallelism |
|-------|---------------|-------------|
| Phase 1, Stream A (F3+F4) | 3-4 hours | Parallel |
| Phase 1, Stream B (F5) | 4-5 hours | Parallel |
| Phase 1, Stream C (F6 component) | 1-2 hours | Parallel |
| Phase 2 (Migration) | 1-2 hours | Sequential |
| Phase 3 (Shared files) | 4-6 hours | Sequential |
| Testing & verification | 2-3 hours | Sequential |
| **Total wall-clock time** | **~12-17 hours** | (vs ~22-28 serial) |
