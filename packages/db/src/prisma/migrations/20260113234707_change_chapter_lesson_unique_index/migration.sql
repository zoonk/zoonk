/*
  Warnings:

  - A unique constraint covering the columns `[chapter_id,slug]` on the table `lessons` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "lessons_organization_id_language_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX "lessons_chapter_id_slug_key" ON "lessons"("chapter_id", "slug");
