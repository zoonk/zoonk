-- AlterEnum
ALTER TYPE "LessonQuestionContextKind" ADD VALUE 'subject';

-- AlterEnum
ALTER TYPE "TutorThreadKind" ADD VALUE 'subject';

-- AlterTable
ALTER TABLE "lesson_question_threads" ADD COLUMN     "subject_goal_id" UUID,
ADD COLUMN     "subject_key" TEXT;

-- CreateIndex
CREATE INDEX "lesson_question_threads_subject_goal_id_idx" ON "lesson_question_threads"("subject_goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_question_threads_user_id_subject_goal_id_subject_key_key" ON "lesson_question_threads"("user_id", "subject_goal_id", "subject_key");

-- AddForeignKey
ALTER TABLE "lesson_question_threads" ADD CONSTRAINT "lesson_question_threads_subject_goal_id_fkey" FOREIGN KEY ("subject_goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

