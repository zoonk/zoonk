-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('pending', 'running', 'completed', 'failed');

-- AlterTable: activities
ALTER TABLE "activities"
ALTER COLUMN "generation_status" DROP DEFAULT,
ALTER COLUMN "generation_status" TYPE "GenerationStatus" USING "generation_status"::"GenerationStatus",
ALTER COLUMN "generation_status" SET DEFAULT 'pending';

-- AlterTable: chapters
ALTER TABLE "chapters"
ALTER COLUMN "generation_status" DROP DEFAULT,
ALTER COLUMN "generation_status" TYPE "GenerationStatus" USING "generation_status"::"GenerationStatus",
ALTER COLUMN "generation_status" SET DEFAULT 'pending';

-- AlterTable: course_suggestions
ALTER TABLE "course_suggestions"
ALTER COLUMN "generation_status" DROP DEFAULT,
ALTER COLUMN "generation_status" TYPE "GenerationStatus" USING "generation_status"::"GenerationStatus",
ALTER COLUMN "generation_status" SET DEFAULT 'pending';

-- AlterTable: courses
ALTER TABLE "courses"
ALTER COLUMN "generation_status" DROP DEFAULT,
ALTER COLUMN "generation_status" TYPE "GenerationStatus" USING "generation_status"::"GenerationStatus",
ALTER COLUMN "generation_status" SET DEFAULT 'completed';

-- AlterTable: lessons
ALTER TABLE "lessons"
ALTER COLUMN "generation_status" DROP DEFAULT,
ALTER COLUMN "generation_status" TYPE "GenerationStatus" USING "generation_status"::"GenerationStatus",
ALTER COLUMN "generation_status" SET DEFAULT 'pending';
