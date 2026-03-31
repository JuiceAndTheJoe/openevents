-- AlterTable
ALTER TABLE "events" ADD COLUMN "collectAllergies" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "attendeeAllergies" TEXT;
