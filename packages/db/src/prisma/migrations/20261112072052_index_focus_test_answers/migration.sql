-- CreateIndex
CREATE INDEX "attempts_user_id_focus_test_id_idx" ON "attempts"("user_id", "focus_test_id") WHERE (focus_test_id IS NOT NULL);
