-- Event soft-delete: add deletedAt column for soft-deletion support
ALTER TABLE "events" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "events_deletedAt_idx" ON "events"("deletedAt");
