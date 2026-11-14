/*
  Warnings:

  - You are about to drop the column `redraw_attempted_at` on the `chapter_mind_maps` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "chapter_mind_maps" DROP COLUMN "redraw_attempted_at",
ADD COLUMN     "redraw_attempts" SMALLINT NOT NULL DEFAULT 0;
