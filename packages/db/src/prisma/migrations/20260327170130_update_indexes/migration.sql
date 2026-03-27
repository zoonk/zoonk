-- DropIndex
DROP INDEX "activity_progress_user_id_idx";

-- DropIndex
DROP INDEX "content_reviews_task_type_idx";

-- DropIndex
DROP INDEX "content_reviews_task_type_status_idx";

-- DropIndex
DROP INDEX "course_users_course_id_idx";

-- DropIndex
DROP INDEX "courses_user_id_idx";

-- DropIndex
DROP INDEX "daily_progress_user_id_date_idx";

-- DropIndex
DROP INDEX "lesson_sentences_lesson_id_idx";

-- DropIndex
DROP INDEX "lesson_words_lesson_id_idx";

-- DropIndex
DROP INDEX "search_prompt_suggestions_search_prompt_id_idx";

-- DropIndex
DROP INDEX "sentences_organization_id_target_language_idx";

-- DropIndex
DROP INDEX "word_pronunciations_word_id_idx";

-- DropIndex
DROP INDEX "words_organization_id_target_language_idx";

-- CreateIndex
CREATE INDEX "activity_progress_user_id_completed_at_idx" ON "activity_progress"("user_id", "completed_at");

-- CreateIndex
CREATE INDEX "activity_progress_started_at_idx" ON "activity_progress"("started_at");

-- CreateIndex
CREATE INDEX "content_reviews_task_type_status_reviewed_at_idx" ON "content_reviews"("task_type", "status", "reviewed_at");

-- CreateIndex
CREATE INDEX "daily_progress_date_idx" ON "daily_progress"("date");

-- CreateIndex
CREATE INDEX "rate_limits_key_idx" ON "rate_limits"("key");

-- CreateIndex
CREATE INDEX "step_attempts_answered_at_idx" ON "step_attempts"("answered_at");

-- CreateIndex
CREATE INDEX "subscriptions_reference_id_idx" ON "subscriptions"("reference_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");
