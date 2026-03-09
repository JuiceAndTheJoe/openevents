-- Add first-login password reset flag for one-time-password accounts
ALTER TABLE "users"
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
