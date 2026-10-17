-- AlterEnum
ALTER TYPE "LessonQuestionContextKind" ADD VALUE 'item';

-- AlterEnum
ALTER TYPE "TutorThreadKind" ADD VALUE 'item';

-- AlterTable
ALTER TABLE "lesson_question_threads" ADD COLUMN     "item_id" UUID;

-- CreateIndex
CREATE INDEX "lesson_question_threads_item_id_idx" ON "lesson_question_threads"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_question_threads_user_id_item_id_key" ON "lesson_question_threads"("user_id", "item_id");

-- AddForeignKey
ALTER TABLE "lesson_question_threads" ADD CONSTRAINT "lesson_question_threads_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

