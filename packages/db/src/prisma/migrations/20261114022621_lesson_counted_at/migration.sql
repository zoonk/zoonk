-- AlterTable
ALTER TABLE "usage_records" ADD COLUMN     "counted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "usage_records_user_id_kind_counted_at_idx" ON "usage_records"("user_id", "kind", "counted_at");

UPDATE usage_records AS claim
SET counted_at = LEAST(
  (SELECT MIN(event.started_at)
   FROM learning_events AS event
   WHERE event.user_id = claim.user_id
     AND event.kind = 'lesson'
     AND event.content_ids->>'lessonId' = claim.target_id::text),
  CASE WHEN NOT claim.generated OR EXISTS (
    SELECT 1 FROM follow_ups AS request
    WHERE request.user_id = claim.user_id
      AND request.kind = 'make_chapter_mind_map'
      AND request.input->'launch'->'lessonIds' ? claim.target_id::text
  ) THEN claim.created_at END
)
WHERE claim.kind = 'lesson_start';
