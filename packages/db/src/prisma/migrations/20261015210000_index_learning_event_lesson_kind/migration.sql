-- CreateIndex
CREATE INDEX "learning_events_user_id_lesson_kind_id_idx" ON "learning_events"("user_id", "lesson_kind", "id");
