-- CreateIndex
CREATE INDEX "learning_events_content_ids_idx" ON "learning_events" USING GIN ("content_ids" jsonb_path_ops);
