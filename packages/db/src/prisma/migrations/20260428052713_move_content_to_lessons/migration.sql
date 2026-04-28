-- AlterEnum
BEGIN;
CREATE TYPE "LessonKind_new" AS ENUM ('custom', 'tutorial', 'explanation', 'practice', 'quiz', 'review', 'alphabet', 'grammar', 'listening', 'reading', 'translation', 'vocabulary');
ALTER TABLE "public"."lessons" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "lessons" ALTER COLUMN "kind" TYPE "LessonKind_new" USING (
  CASE "kind"::text
    WHEN 'core' THEN 'explanation'
    WHEN 'language' THEN 'vocabulary'
    ELSE "kind"::text
  END::"LessonKind_new"
);
ALTER TYPE "LessonKind" RENAME TO "LessonKind_old";
ALTER TYPE "LessonKind_new" RENAME TO "LessonKind";
DROP TYPE "public"."LessonKind_old";
ALTER TABLE "lessons" ALTER COLUMN "kind" SET DEFAULT 'custom';
COMMIT;

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "activity_progress" DROP CONSTRAINT "activity_progress_activity_id_fkey";

-- DropForeignKey
ALTER TABLE "activity_progress" DROP CONSTRAINT "activity_progress_user_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_completions" DROP CONSTRAINT "lesson_completions_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_completions" DROP CONSTRAINT "lesson_completions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "steps" DROP CONSTRAINT "steps_activity_id_fkey";

-- DropIndex
DROP INDEX "steps_activity_id_kind_position_idx";

-- DropIndex
DROP INDEX "steps_activity_id_position_idx";

-- AlterTable
ALTER TABLE "lessons" DROP COLUMN "concepts",
ALTER COLUMN "kind" SET DEFAULT 'custom';

-- AlterTable
ALTER TABLE "steps" ADD COLUMN "lesson_id" UUID;
UPDATE "steps"
SET "lesson_id" = "activities"."lesson_id"
FROM "activities"
WHERE "steps"."activity_id" = "activities"."id";
DELETE FROM "steps" WHERE "lesson_id" IS NULL;
ALTER TABLE "steps" ALTER COLUMN "lesson_id" SET NOT NULL;
ALTER TABLE "steps" DROP COLUMN "activity_id";

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_progress_lesson_id_idx" ON "lesson_progress"("lesson_id");

-- CreateIndex
CREATE INDEX "lesson_progress_user_id_completed_at_idx" ON "lesson_progress"("user_id", "completed_at");

-- CreateIndex
CREATE INDEX "lesson_progress_started_at_idx" ON "lesson_progress"("started_at");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_user_id_lesson_id_key" ON "lesson_progress"("user_id", "lesson_id");

-- DataMigration
INSERT INTO "lesson_progress" ("user_id", "lesson_id", "started_at", "completed_at", "duration_seconds")
SELECT
  "user_id",
  "lesson_id",
  "completed_at",
  "completed_at",
  NULL
FROM "lesson_completions"
ON CONFLICT ("user_id", "lesson_id") DO UPDATE SET
  "completed_at" = COALESCE("lesson_progress"."completed_at", EXCLUDED."completed_at"),
  "started_at" = LEAST("lesson_progress"."started_at", EXCLUDED."started_at");

INSERT INTO "lesson_progress" ("user_id", "lesson_id", "started_at", "completed_at", "duration_seconds")
SELECT
  "activity_progress"."user_id",
  "activities"."lesson_id",
  MIN("activity_progress"."started_at"),
  MAX("activity_progress"."completed_at"),
  SUM(COALESCE("activity_progress"."duration_seconds", 0))::int
FROM "activity_progress"
JOIN "activities" ON "activities"."id" = "activity_progress"."activity_id"
GROUP BY "activity_progress"."user_id", "activities"."lesson_id"
ON CONFLICT ("user_id", "lesson_id") DO UPDATE SET
  "completed_at" = COALESCE("lesson_progress"."completed_at", EXCLUDED."completed_at"),
  "duration_seconds" = COALESCE("lesson_progress"."duration_seconds", 0) + COALESCE(EXCLUDED."duration_seconds", 0),
  "started_at" = LEAST("lesson_progress"."started_at", EXCLUDED."started_at");

-- DropTable
DROP TABLE "activities";

-- DropTable
DROP TABLE "activity_progress";

-- DropTable
DROP TABLE "lesson_completions";

-- DropEnum
DROP TYPE "ActivityKind";

-- CreateIndex
CREATE INDEX "steps_lesson_id_position_idx" ON "steps"("lesson_id", "position");

-- CreateIndex
CREATE INDEX "steps_lesson_id_kind_position_idx" ON "steps"("lesson_id", "kind", "position");

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
