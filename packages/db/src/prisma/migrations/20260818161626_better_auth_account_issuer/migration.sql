-- Better Auth 1.7 identifies external accounts by their trusted issuer and provider subject.
-- Keep this nullable only while the existing provider rows are mapped below.
BEGIN;

ALTER TABLE "accounts" ADD COLUMN "issuer" TEXT;

-- Unknown providers require a reviewed trusted-issuer mapping. Failing closed avoids assigning
-- an identity based on mutable profile data or an unverified provider URL.
DO $$
DECLARE
  unexpected_provider_ids TEXT;
BEGIN
  SELECT STRING_AGG("provider_id", ', ' ORDER BY "provider_id")
  INTO unexpected_provider_ids
  FROM (
    SELECT DISTINCT "provider_id"
    FROM "accounts"
    WHERE "provider_id" NOT IN ('apple', 'credential', 'google')
  ) AS unexpected_providers;

  IF unexpected_provider_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Better Auth 1.7 issuer mapping is missing for provider_id values: %', unexpected_provider_ids;
  END IF;
END $$;

-- Credential identity is the linked user's stable ID in 1.7; email is a mutable sign-in identifier.
UPDATE "accounts"
SET
  "account_id" = "user_id"::TEXT,
  "issuer" = 'local:credential'
WHERE "provider_id" = 'credential';

UPDATE "accounts"
SET "issuer" = 'https://appleid.apple.com'
WHERE "provider_id" = 'apple';

UPDATE "accounts"
SET "issuer" = 'https://accounts.google.com'
WHERE "provider_id" = 'google';

-- Never pick an arbitrary owner when the new canonical identity exposes legacy collisions.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "accounts"
    GROUP BY "issuer", "account_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Better Auth 1.7 account identity collisions must be resolved before migration';
  END IF;
END $$;

ALTER TABLE "accounts" ALTER COLUMN "issuer" SET NOT NULL;

CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "accounts"("issuer", "account_id");

COMMIT;
