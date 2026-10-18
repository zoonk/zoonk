-- AlterTable
ALTER TABLE "lesson_questions" ADD COLUMN     "goal_id" UUID;

-- CreateIndex
CREATE INDEX "lesson_questions_goal_id_idx" ON "lesson_questions"("goal_id");

-- AddForeignKey
ALTER TABLE "lesson_questions" ADD CONSTRAINT "lesson_questions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
