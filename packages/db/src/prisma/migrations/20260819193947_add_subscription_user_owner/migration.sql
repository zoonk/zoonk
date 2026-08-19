-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "user_id" UUID;

-- Apple subscriptions are always tied to the Zoonk user encoded by appAccountToken.
-- Remove any orphan created by the former deletion race before enforcing that ownership.
DELETE FROM "subscriptions"
WHERE "provider" = 'apple'
AND NOT EXISTS (
    SELECT 1 FROM "users" WHERE "users"."id" = "subscriptions"."reference_id"
);

UPDATE "subscriptions"
SET "user_id" = "reference_id"
WHERE "provider" = 'apple';

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- referenceId remains polymorphic for Better Auth user and organization billing.
-- When a row has a user owner, both identifiers must describe the same owner.
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_reference_matches_check" CHECK ("user_id" IS NULL OR "user_id" = "reference_id");

-- App Store notifications must never create an Apple row outside the User cascade.
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_apple_user_id_check" CHECK ("provider" <> 'apple' OR "user_id" IS NOT NULL);
