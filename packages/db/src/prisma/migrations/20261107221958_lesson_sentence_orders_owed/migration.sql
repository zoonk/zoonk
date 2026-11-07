-- AlterTable
ALTER TABLE "lesson_sentences" ADD COLUMN     "orders_owed_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "library_lessons" ADD COLUMN     "sentence_orders_attempts" SMALLINT NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "lesson_sentences_orders_owed_at_lesson_id_idx" ON "lesson_sentences"("orders_owed_at", "lesson_id");
