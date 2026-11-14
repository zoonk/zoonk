-- AlterTable
ALTER TABLE "chapter_mind_maps" ADD COLUMN     "redraw_attempted_at" TIMESTAMP(3),
ADD COLUMN     "redraw_owed_at" TIMESTAMP(3);
