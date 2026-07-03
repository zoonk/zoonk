-- DropIndex
DROP INDEX "chapters_course_id_position_idx";

-- CreateIndex
CREATE UNIQUE INDEX "chapters_course_id_position_key" ON "chapters"("course_id", "position");
