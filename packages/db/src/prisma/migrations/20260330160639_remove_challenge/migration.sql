/*
  Warnings:

  - The values [challenge] on the enum `ActivityKind` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `challenges_completed` on the `daily_progress` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ActivityKind_new" AS ENUM ('custom', 'explanation', 'quiz', 'practice', 'vocabulary', 'grammar', 'reading', 'listening', 'translation', 'review');
ALTER TABLE "public"."activities" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "activities" ALTER COLUMN "kind" TYPE "ActivityKind_new" USING ("kind"::text::"ActivityKind_new");
ALTER TYPE "ActivityKind" RENAME TO "ActivityKind_old";
ALTER TYPE "ActivityKind_new" RENAME TO "ActivityKind";
DROP TYPE "public"."ActivityKind_old";
ALTER TABLE "activities" ALTER COLUMN "kind" SET DEFAULT 'custom';
COMMIT;

-- AlterTable
ALTER TABLE "daily_progress" DROP COLUMN "challenges_completed";
