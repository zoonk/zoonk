/*
  Warnings:

  - The values [story,investigation] on the enum `ActivityKind` will be removed. If these variants are still used in the database, this will fail.
  - The values [story,investigation] on the enum `StepKind` will be removed. If these variants are still used in the database, this will fail.

*/
DELETE FROM "steps" WHERE "kind"::text IN ('story', 'investigation');
DELETE FROM "activities" WHERE "kind"::text IN ('story', 'investigation');

-- AlterEnum
BEGIN;
CREATE TYPE "ActivityKind_new" AS ENUM ('custom', 'review', 'explanation', 'practice', 'quiz', 'grammar', 'listening', 'reading', 'translation', 'vocabulary');
ALTER TABLE "public"."activities" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "activities" ALTER COLUMN "kind" TYPE "ActivityKind_new" USING ("kind"::text::"ActivityKind_new");
ALTER TYPE "ActivityKind" RENAME TO "ActivityKind_old";
ALTER TYPE "ActivityKind_new" RENAME TO "ActivityKind";
DROP TYPE "public"."ActivityKind_old";
ALTER TABLE "activities" ALTER COLUMN "kind" SET DEFAULT 'custom';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "StepKind_new" AS ENUM ('arrange_words', 'fill_blank', 'listening', 'match_columns', 'multiple_choice', 'reading', 'select_image', 'sort_order', 'static', 'translation', 'visual', 'vocabulary');
ALTER TABLE "steps" ALTER COLUMN "kind" TYPE "StepKind_new" USING ("kind"::text::"StepKind_new");
ALTER TYPE "StepKind" RENAME TO "StepKind_old";
ALTER TYPE "StepKind_new" RENAME TO "StepKind";
DROP TYPE "public"."StepKind_old";
COMMIT;
