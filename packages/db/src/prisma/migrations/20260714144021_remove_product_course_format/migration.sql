-- Map existing product formats to the equivalent practical format before removing the enum value.
UPDATE "courses" SET "format" = 'practical' WHERE "format" = 'product';
UPDATE "course_prompts" SET "course_format" = 'practical' WHERE "course_format" = 'product';

-- AlterEnum
BEGIN;
CREATE TYPE "CourseFormat_new" AS ENUM ('coding', 'core', 'exam', 'instrument', 'language', 'personalized', 'practical', 'question');
ALTER TABLE "public"."courses" ALTER COLUMN "format" DROP DEFAULT;
ALTER TABLE "courses" ALTER COLUMN "format" TYPE "CourseFormat_new" USING ("format"::text::"CourseFormat_new");
ALTER TABLE "course_prompts" ALTER COLUMN "course_format" TYPE "CourseFormat_new" USING ("course_format"::text::"CourseFormat_new");
ALTER TYPE "CourseFormat" RENAME TO "CourseFormat_old";
ALTER TYPE "CourseFormat_new" RENAME TO "CourseFormat";
DROP TYPE "public"."CourseFormat_old";
ALTER TABLE "courses" ALTER COLUMN "format" SET DEFAULT 'core';
COMMIT;
