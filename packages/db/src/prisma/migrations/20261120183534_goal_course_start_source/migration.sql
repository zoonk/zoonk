-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "source_course_id" UUID;

-- CreateIndex
CREATE INDEX "goals_source_course_id_idx" ON "goals"("source_course_id");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_source_course_id_fkey" FOREIGN KEY ("source_course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
