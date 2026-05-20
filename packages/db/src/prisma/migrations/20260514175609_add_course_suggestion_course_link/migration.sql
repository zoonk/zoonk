/*
  Warnings:

  - You are about to drop the `course_alternative_titles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "course_alternative_titles" DROP CONSTRAINT "course_alternative_titles_course_id_fkey";

-- AlterTable
ALTER TABLE "course_suggestions" ADD COLUMN     "course_id" UUID;

-- DropTable
DROP TABLE "course_alternative_titles";

-- CreateIndex
CREATE INDEX "course_suggestions_course_id_idx" ON "course_suggestions"("course_id");

-- AddForeignKey
ALTER TABLE "course_suggestions" ADD CONSTRAINT "course_suggestions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
