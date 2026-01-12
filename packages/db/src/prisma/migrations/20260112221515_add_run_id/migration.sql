-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "generation_run_id" TEXT;

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "generation_run_id" TEXT;

-- AlterTable
ALTER TABLE "course_suggestions" ADD COLUMN     "generation_run_id" TEXT,
ADD COLUMN     "generation_status" VARCHAR(20) NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "generation_run_id" TEXT;

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "generation_run_id" TEXT;
