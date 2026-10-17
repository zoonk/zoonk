-- AlterTable
ALTER TABLE "plan_items" ADD COLUMN     "facts" JSONB,
ADD COLUMN     "minutes" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "input_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "source_skill_ids" UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN     "summary" JSONB;

-- CreateIndex
CREATE INDEX "plans_source_skill_ids_idx" ON "plans" USING GIN ("source_skill_ids");
