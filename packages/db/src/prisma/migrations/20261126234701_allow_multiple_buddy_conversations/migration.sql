-- DropIndex
DROP INDEX "lesson_question_threads_user_id_goal_id_key";

-- CreateIndex
CREATE INDEX "lesson_question_threads_user_id_goal_id_updated_at_id_idx" ON "lesson_question_threads"("user_id", "goal_id", "updated_at", "id");
