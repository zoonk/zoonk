-- CreateIndex
CREATE INDEX "attempts_test_answers_user_id_skill_id_idx" ON "attempts"("user_id", "skill_id") WHERE ((mock_exam_id IS NULL) AND (is_placement OR ((item_id IS NOT NULL) AND (step_id IS NULL) AND (study_session_id IS NULL))));
