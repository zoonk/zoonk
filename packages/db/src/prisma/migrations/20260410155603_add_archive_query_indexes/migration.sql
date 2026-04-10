-- DropIndex
DROP INDEX "activities_lesson_id_position_idx";

-- DropIndex
DROP INDEX "chapters_course_id_position_idx";

-- DropIndex
DROP INDEX "chapters_organization_id_normalized_title_idx";

-- DropIndex
DROP INDEX "courses_organization_id_language_is_published_idx";

-- DropIndex
DROP INDEX "courses_organization_id_normalized_title_idx";

-- DropIndex
DROP INDEX "lessons_chapter_id_position_idx";

-- DropIndex
DROP INDEX "lessons_organization_id_normalized_title_idx";

-- DropIndex
DROP INDEX "steps_activity_id_position_idx";

-- CreateIndex
CREATE INDEX "activities_lesson_id_archived_at_position_idx" ON "activities"("lesson_id", "archived_at", "position");

-- CreateIndex
CREATE INDEX "activities_lesson_id_archived_at_generation_status_idx" ON "activities"("lesson_id", "archived_at", "generation_status");

-- CreateIndex
CREATE INDEX "chapters_organization_id_archived_at_normalized_title_idx" ON "chapters"("organization_id", "archived_at", "normalized_title");

-- CreateIndex
CREATE INDEX "chapters_course_id_archived_at_position_idx" ON "chapters"("course_id", "archived_at", "position");

-- CreateIndex
CREATE INDEX "courses_organization_id_archived_at_normalized_title_idx" ON "courses"("organization_id", "archived_at", "normalized_title");

-- CreateIndex
CREATE INDEX "courses_organization_id_is_published_archived_at_created_at_idx" ON "courses"("organization_id", "is_published", "archived_at", "created_at");

-- CreateIndex
CREATE INDEX "courses_is_published_archived_at_normalized_title_idx" ON "courses"("is_published", "archived_at", "normalized_title");

-- CreateIndex
CREATE INDEX "courses_is_published_archived_at_language_user_count_id_idx" ON "courses"("is_published", "archived_at", "language", "user_count", "id");

-- CreateIndex
CREATE INDEX "lessons_organization_id_archived_at_normalized_title_idx" ON "lessons"("organization_id", "archived_at", "normalized_title");

-- CreateIndex
CREATE INDEX "lessons_chapter_id_archived_at_position_idx" ON "lessons"("chapter_id", "archived_at", "position");

-- CreateIndex
CREATE INDEX "steps_activity_id_archived_at_position_idx" ON "steps"("activity_id", "archived_at", "position");

-- CreateIndex
CREATE INDEX "steps_activity_id_kind_archived_at_position_idx" ON "steps"("activity_id", "kind", "archived_at", "position");
