-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "opening_lesson_id" UUID;

-- CreateIndex
CREATE INDEX "goals_opening_lesson_id_idx" ON "goals"("opening_lesson_id");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_opening_lesson_id_fkey" FOREIGN KEY ("opening_lesson_id") REFERENCES "library_lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
