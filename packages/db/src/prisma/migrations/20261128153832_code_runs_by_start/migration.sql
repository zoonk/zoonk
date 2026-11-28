-- DropIndex
DROP INDEX "code_runs_user_id_finished_at_idx";

-- CreateIndex
CREATE INDEX "code_runs_user_id_started_at_idx" ON "code_runs"("user_id", "started_at");
