-- CreateEnum
CREATE TYPE "LessonKind" AS ENUM ('core', 'language', 'custom');

-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('custom', 'background', 'explanation', 'quiz', 'mechanics', 'examples', 'story', 'challenge', 'vocabulary', 'grammar', 'reading', 'listening', 'pronunciation', 'review');

-- Update existing activity kind values to match the new enum
UPDATE "activities" SET "kind" = 'quiz' WHERE "kind" IN ('explanation_quiz', 'lesson_quiz', 'logic');

-- AlterTable activities: Convert kind column from VARCHAR to ActivityKind enum
ALTER TABLE "activities"
  ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "activities"
  ALTER COLUMN "kind" TYPE "ActivityKind" USING "kind"::"ActivityKind";
ALTER TABLE "activities"
  ALTER COLUMN "kind" SET DEFAULT 'custom';

-- AlterTable lessons: Convert kind column from VARCHAR to LessonKind enum
ALTER TABLE "lessons"
  ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "lessons"
  ALTER COLUMN "kind" TYPE "LessonKind" USING "kind"::"LessonKind";
ALTER TABLE "lessons"
  ALTER COLUMN "kind" SET DEFAULT 'core';
