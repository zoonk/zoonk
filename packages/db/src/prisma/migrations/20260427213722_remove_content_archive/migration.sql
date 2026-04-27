/*
  Warnings:

  - You are about to drop the column `archived_at` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `archived_at` on the `chapters` table. All the data in the column will be lost.
  - You are about to drop the column `archived_at` on the `courses` table. All the data in the column will be lost.
  - You are about to drop the column `archived_at` on the `lessons` table. All the data in the column will be lost.
  - You are about to drop the column `archived_at` on the `steps` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "activities_lesson_id_archived_at_generation_status_idx";

-- DropIndex
DROP INDEX "activities_lesson_id_archived_at_position_idx";

-- DropIndex
DROP INDEX "chapters_course_id_archived_at_position_idx";

-- DropIndex
DROP INDEX "chapters_organization_id_archived_at_normalized_title_idx";

-- DropIndex
DROP INDEX "courses_is_published_archived_at_language_user_count_id_idx";

-- DropIndex
DROP INDEX "courses_is_published_archived_at_normalized_title_idx";

-- DropIndex
DROP INDEX "courses_organization_id_archived_at_normalized_title_idx";

-- DropIndex
DROP INDEX "courses_organization_id_is_published_archived_at_created_at_idx";

-- DropIndex
DROP INDEX "lessons_chapter_id_archived_at_position_idx";

-- DropIndex
DROP INDEX "lessons_organization_id_archived_at_normalized_title_idx";

-- DropIndex
DROP INDEX "steps_activity_id_archived_at_position_idx";

-- DropIndex
DROP INDEX "steps_activity_id_kind_archived_at_position_idx";

-- AlterTable
ALTER TABLE "activities" DROP COLUMN "archived_at";

-- AlterTable
ALTER TABLE "chapters" DROP COLUMN "archived_at";

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "archived_at";

-- AlterTable
ALTER TABLE "lessons" DROP COLUMN "archived_at";

-- AlterTable
ALTER TABLE "steps" DROP COLUMN "archived_at";

-- CreateIndex
CREATE INDEX "activities_lesson_id_position_idx" ON "activities"("lesson_id", "position");

-- CreateIndex
CREATE INDEX "activities_lesson_id_generation_status_idx" ON "activities"("lesson_id", "generation_status");

-- CreateIndex
CREATE INDEX "chapters_organization_id_normalized_title_idx" ON "chapters"("organization_id", "normalized_title");

-- CreateIndex
CREATE INDEX "chapters_course_id_position_idx" ON "chapters"("course_id", "position");

-- CreateIndex
CREATE INDEX "courses_organization_id_normalized_title_idx" ON "courses"("organization_id", "normalized_title");

-- CreateIndex
CREATE INDEX "courses_organization_id_is_published_created_at_idx" ON "courses"("organization_id", "is_published", "created_at");

-- CreateIndex
CREATE INDEX "courses_is_published_normalized_title_idx" ON "courses"("is_published", "normalized_title");

-- CreateIndex
CREATE INDEX "courses_is_published_language_user_count_id_idx" ON "courses"("is_published", "language", "user_count", "id");

-- CreateIndex
CREATE INDEX "lessons_organization_id_normalized_title_idx" ON "lessons"("organization_id", "normalized_title");

-- CreateIndex
CREATE INDEX "lessons_chapter_id_position_idx" ON "lessons"("chapter_id", "position");

-- CreateIndex
CREATE INDEX "steps_activity_id_position_idx" ON "steps"("activity_id", "position");

-- CreateIndex
CREATE INDEX "steps_activity_id_kind_position_idx" ON "steps"("activity_id", "kind", "position");
