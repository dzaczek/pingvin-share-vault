-- AlterTable
ALTER TABLE "User" ADD COLUMN "confirmedEmail" TEXT;

-- Accounts the app already treated as confirmed keep that status. LDAP
-- accounts are left out: their address may have been typed at sign in, and
-- the next sign in confirms the directory's address instead.
UPDATE "User" SET "confirmedEmail" = "email"
WHERE "isActivated" = true AND "activationToken" IS NULL
  AND "ldapDN" IS NULL;
