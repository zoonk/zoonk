-- CreateEnum
CREATE TYPE "MaterialIntent" AS ENUM ('exam', 'understand');

-- AlterTable
ALTER TABLE "onboarding_drafts" ADD COLUMN     "material_intent" "MaterialIntent",
ADD COLUMN     "source_ids" UUID[] DEFAULT ARRAY[]::UUID[];
