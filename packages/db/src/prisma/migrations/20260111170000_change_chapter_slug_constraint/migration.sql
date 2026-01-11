-- DropIndex
DROP INDEX "chapters_organization_id_language_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX "chapters_course_id_slug_key" ON "chapters"("course_id", "slug");
