-- AlterTable
ALTER TABLE "User" ADD COLUMN "confirmedEmail" TEXT;

-- Accounts the app already treated as confirmed keep that status
UPDATE "User" SET "confirmedEmail" = "email"
WHERE "isActivated" = true AND "activationToken" IS NULL;
