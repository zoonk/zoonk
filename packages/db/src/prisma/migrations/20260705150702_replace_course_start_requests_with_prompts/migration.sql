-- CreateEnum
CREATE TYPE "CourseFormat" AS ENUM ('coding', 'core', 'exam', 'instrument', 'language', 'personalized', 'practical', 'product', 'question');

-- CreateEnum
CREATE TYPE "CoursePromptIntent" AS ENUM ('ambiguous', 'exam', 'learn', 'question', 'unsafe');

-- DropForeignKey
ALTER TABLE "course_start_requests" DROP CONSTRAINT "course_start_requests_course_id_fkey";

-- DropIndex
DROP INDEX "courses_user_id_mode_idx";

-- AlterTable
ALTER TABLE "courses" ADD COLUMN "format" "CourseFormat";

UPDATE "courses"
SET "format" = CASE
  WHEN "target_language" IS NOT NULL THEN 'language'::"CourseFormat"
  WHEN "mode" = 'exam' THEN 'exam'::"CourseFormat"
  WHEN "mode" = 'personalized' THEN 'personalized'::"CourseFormat"
  WHEN "mode" = 'quick' THEN 'question'::"CourseFormat"
  ELSE 'core'::"CourseFormat"
END;

ALTER TABLE "courses" ALTER COLUMN "format" SET NOT NULL;
ALTER TABLE "courses" ALTER COLUMN "format" SET DEFAULT 'core';
ALTER TABLE "courses" DROP COLUMN "mode";

-- DropTable
DROP TABLE "course_start_requests";

-- DropEnum
DROP TYPE "CourseMode";

-- DropEnum
DROP TYPE "CourseStartScope";

-- CreateTable
CREATE TABLE "course_prompts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "course_id" UUID,
    "language" VARCHAR(10) NOT NULL,
    "prompt" TEXT NOT NULL,
    "normalized_prompt" TEXT NOT NULL,
    "intent" "CoursePromptIntent" NOT NULL,
    "course_format" "CourseFormat",
    "canonical_title" TEXT,
    "target_language" VARCHAR(10),
    "generation_status" "GenerationStatus",
    "generation_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_prompts_course_id_idx" ON "course_prompts"("course_id");

-- CreateIndex
CREATE INDEX "course_prompts_intent_created_at_idx" ON "course_prompts"("intent", "created_at");

-- CreateIndex
CREATE INDEX "course_prompts_course_format_created_at_idx" ON "course_prompts"("course_format", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "course_prompts_language_normalized_prompt_key" ON "course_prompts"("language", "normalized_prompt");

-- CreateIndex
CREATE INDEX "courses_user_id_format_idx" ON "courses"("user_id", "format");

-- AddForeignKey
ALTER TABLE "course_prompts" ADD CONSTRAINT "course_prompts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
