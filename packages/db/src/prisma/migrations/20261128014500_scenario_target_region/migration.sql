-- AlterTable
ALTER TABLE "conversation_scenarios" ADD COLUMN     "target_region" VARCHAR(2) NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "conversation_scenarios_chapter_id_level_target_region_key" ON "conversation_scenarios"("chapter_id", "level", "target_region");

-- DropIndex
DROP INDEX "conversation_scenarios_chapter_id_level_key";
