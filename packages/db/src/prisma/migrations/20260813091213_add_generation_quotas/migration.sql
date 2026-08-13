-- CreateEnum
CREATE TYPE "GenerationQuotaPeriod" AS ENUM ('day', 'month');

-- CreateEnum
CREATE TYPE "GenerationQuotaResource" AS ENUM ('course', 'chapter', 'lesson');

-- CreateTable
CREATE TABLE "generation_quota_counters" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "actor_key" VARCHAR(80) NOT NULL,
    "resource" "GenerationQuotaResource" NOT NULL,
    "period" "GenerationQuotaPeriod" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_quota_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_quota_claims" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "actor_key" VARCHAR(80) NOT NULL,
    "resource" "GenerationQuotaResource" NOT NULL,
    "target_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_quota_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generation_quota_counters_period_start_idx" ON "generation_quota_counters"("period_start");

-- CreateIndex
CREATE UNIQUE INDEX "generation_quota_counters_actor_key_resource_period_period__key" ON "generation_quota_counters"("actor_key", "resource", "period", "period_start");

-- CreateIndex
CREATE INDEX "generation_quota_claims_actor_key_created_at_idx" ON "generation_quota_claims"("actor_key", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "generation_quota_claims_resource_target_id_key" ON "generation_quota_claims"("resource", "target_id");
