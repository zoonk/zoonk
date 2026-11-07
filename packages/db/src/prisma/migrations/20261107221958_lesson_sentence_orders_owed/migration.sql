-- AlterTable
ALTER TABLE "library_lessons" ADD COLUMN     "sentence_orders_attempts" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "sentence_orders_owed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "library_lessons_sentence_orders_owed_at_idx" ON "library_lessons"("sentence_orders_owed_at");

-- Language lessons written before their sentences had other word orders.
UPDATE "library_lessons" SET "sentence_orders_owed_at" = NOW()
WHERE EXISTS (
  SELECT 1 FROM "lesson_sentences" WHERE "lesson_sentences"."lesson_id" = "library_lessons"."id"
);
