/*
  Warnings:

  - The values [quick_lesson,exam_prep] on the enum `CourseMode` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CourseMode_new" AS ENUM ('exam', 'full', 'overview', 'personalized', 'quick');
ALTER TABLE "public"."courses" ALTER COLUMN "mode" DROP DEFAULT;
ALTER TABLE "courses" ALTER COLUMN "mode" TYPE "CourseMode_new" USING ("mode"::text::"CourseMode_new");
ALTER TYPE "CourseMode" RENAME TO "CourseMode_old";
ALTER TYPE "CourseMode_new" RENAME TO "CourseMode";
DROP TYPE "public"."CourseMode_old";
ALTER TABLE "courses" ALTER COLUMN "mode" SET DEFAULT 'full';
COMMIT;
