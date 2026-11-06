-- AlterTable
ALTER TABLE "library_lessons" ADD COLUMN     "staged_summary" JSONB;

-- AlterTable
ALTER TABLE "library_steps" ADD COLUMN     "staged" BOOLEAN NOT NULL DEFAULT false;
