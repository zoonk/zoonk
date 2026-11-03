-- CreateEnum
CREATE TYPE "WarmUpStatus" AS ENUM ('writing', 'ready', 'failed');

-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "warm_up_id" UUID;

-- CreateTable
CREATE TABLE "warm_ups" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "language" VARCHAR(10) NOT NULL,
    "identity_key" TEXT NOT NULL,
    "status" "WarmUpStatus" NOT NULL DEFAULT 'writing',
    "cards" JSONB,
    "writer_model" TEXT,
    "checker_model" TEXT,
    "prompt_version" TEXT,
    "run_id" TEXT NOT NULL,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warm_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warm_ups_language_identity_key_key" ON "warm_ups"("language", "identity_key");

-- CreateIndex
CREATE INDEX "goals_warm_up_id_idx" ON "goals"("warm_up_id");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_warm_up_id_fkey" FOREIGN KEY ("warm_up_id") REFERENCES "warm_ups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
