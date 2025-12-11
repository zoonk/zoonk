/*
  Warnings:

  - Added the required column `normalized_title` to the `courses` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "normalized_title" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "courses_organization_id_normalized_title_idx" ON "courses"("organization_id", "normalized_title");
