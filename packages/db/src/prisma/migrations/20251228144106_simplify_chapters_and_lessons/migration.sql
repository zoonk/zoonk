/*
  Warnings:

  - You are about to drop the `chapter_lessons` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `course_chapters` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[organization_id,language,slug]` on the table `chapters` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,language,slug]` on the table `lessons` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `course_id` to the `chapters` table without a default value. This is not possible if the table is not empty.
  - Added the required column `language` to the `chapters` table without a default value. This is not possible if the table is not empty.
  - Added the required column `position` to the `chapters` table without a default value. This is not possible if the table is not empty.
  - Added the required column `chapter_id` to the `lessons` table without a default value. This is not possible if the table is not empty.
  - Added the required column `language` to the `lessons` table without a default value. This is not possible if the table is not empty.
  - Added the required column `position` to the `lessons` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "chapter_lessons" DROP CONSTRAINT "chapter_lessons_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "chapter_lessons" DROP CONSTRAINT "chapter_lessons_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "course_chapters" DROP CONSTRAINT "course_chapters_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "course_chapters" DROP CONSTRAINT "course_chapters_course_id_fkey";

-- DropIndex
DROP INDEX "chapters_organization_id_slug_key";

-- DropIndex
DROP INDEX "lessons_organization_id_slug_key";

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "course_id" INTEGER NOT NULL,
ADD COLUMN     "language" VARCHAR(10) NOT NULL,
ADD COLUMN     "position" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "chapter_id" INTEGER NOT NULL,
ADD COLUMN     "language" VARCHAR(10) NOT NULL,
ADD COLUMN     "position" INTEGER NOT NULL;

-- DropTable
DROP TABLE "chapter_lessons";

-- DropTable
DROP TABLE "course_chapters";

-- CreateIndex
CREATE INDEX "chapters_course_id_position_idx" ON "chapters"("course_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_organization_id_language_slug_key" ON "chapters"("organization_id", "language", "slug");

-- CreateIndex
CREATE INDEX "lessons_chapter_id_position_idx" ON "lessons"("chapter_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_organization_id_language_slug_key" ON "lessons"("organization_id", "language", "slug");

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
