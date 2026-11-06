-- AlterTable
-- Icons claimed before a claim recorded its run belong to no run.
ALTER TABLE "lesson_icons" ADD COLUMN "run_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "lesson_icons" ALTER COLUMN "run_id" DROP DEFAULT;
