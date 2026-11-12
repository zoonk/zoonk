-- CreateEnum
CREATE TYPE "ContentFixStatus" AS ENUM ('proposed', 'applied', 'rejected', 'stale');

-- CreateEnum
CREATE TYPE "ContentFixUnit" AS ENUM ('course', 'chapter', 'lesson', 'item');

-- CreateTable
CREATE TABLE "passkeys" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT,
    "public_key" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "credential_id" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "device_type" TEXT NOT NULL,
    "backed_up" BOOLEAN NOT NULL,
    "transports" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "aaguid" TEXT,

    CONSTRAINT "passkeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_fixes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "status" "ContentFixStatus" NOT NULL DEFAULT 'proposed',
    "unit" "ContentFixUnit" NOT NULL,
    "unit_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "effects" JSONB NOT NULL,
    "feedback_id" UUID,
    "reverts_id" UUID,
    "proposer_id" UUID,
    "proposer_client_id" TEXT NOT NULL,
    "decider_id" UUID,
    "decided_at" TIMESTAMP(3),
    "stale_reason" TEXT,
    "approval_challenge" TEXT,
    "approval_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_fixes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "passkeys_user_id_idx" ON "passkeys"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "passkeys_credential_id_key" ON "passkeys"("credential_id");

-- CreateIndex
CREATE INDEX "content_fixes_status_created_at_idx" ON "content_fixes"("status", "created_at");

-- CreateIndex
CREATE INDEX "content_fixes_unit_unit_id_idx" ON "content_fixes"("unit", "unit_id");

-- CreateIndex
CREATE INDEX "content_fixes_feedback_id_idx" ON "content_fixes"("feedback_id");

-- CreateIndex
CREATE INDEX "content_fixes_reverts_id_idx" ON "content_fixes"("reverts_id");

-- CreateIndex
CREATE INDEX "content_fixes_proposer_id_idx" ON "content_fixes"("proposer_id");

-- CreateIndex
CREATE INDEX "content_fixes_decider_id_idx" ON "content_fixes"("decider_id");

-- AddForeignKey
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_fixes" ADD CONSTRAINT "content_fixes_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_fixes" ADD CONSTRAINT "content_fixes_reverts_id_fkey" FOREIGN KEY ("reverts_id") REFERENCES "content_fixes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_fixes" ADD CONSTRAINT "content_fixes_proposer_id_fkey" FOREIGN KEY ("proposer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_fixes" ADD CONSTRAINT "content_fixes_decider_id_fkey" FOREIGN KEY ("decider_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The CLI may ask to propose content fixes; a login without this scope stays read-only.
UPDATE "oauth_clients" SET "scopes" = ARRAY['staff:read', 'staff:propose', 'offline_access'] WHERE "client_id" = 'zoonk-cli';
