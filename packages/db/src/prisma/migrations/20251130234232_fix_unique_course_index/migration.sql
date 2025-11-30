/*
  Warnings:

  - A unique constraint covering the columns `[organization_id,language,slug]` on the table `courses` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "courses_organization_id_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX "courses_organization_id_language_slug_key" ON "courses"("organization_id", "language", "slug");
