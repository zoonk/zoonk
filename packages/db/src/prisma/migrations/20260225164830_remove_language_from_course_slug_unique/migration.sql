/*
  Warnings:

  - A unique constraint covering the columns `[organization_id,slug]` on the table `courses` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,slug]` on the table `courses` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "courses_organization_id_language_slug_key";

-- DropIndex
DROP INDEX "courses_user_id_language_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX "courses_organization_id_slug_key" ON "courses"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "courses_user_id_slug_key" ON "courses"("user_id", "slug");
