/*
  Warnings:

  - You are about to drop the `course_suggestions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `search_prompt_suggestions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `search_prompts` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "CourseStartScope" AS ENUM ('exam', 'language', 'personalized', 'question', 'topic', 'unsafe');

-- DropForeignKey
ALTER TABLE "course_suggestions" DROP CONSTRAINT "course_suggestions_course_id_fkey";

-- DropForeignKey
ALTER TABLE "search_prompt_suggestions" DROP CONSTRAINT "search_prompt_suggestions_course_suggestion_id_fkey";

-- DropForeignKey
ALTER TABLE "search_prompt_suggestions" DROP CONSTRAINT "search_prompt_suggestions_search_prompt_id_fkey";

-- DropTable
DROP TABLE "course_suggestions";

-- DropTable
DROP TABLE "search_prompt_suggestions";

-- DropTable
DROP TABLE "search_prompts";

-- CreateTable
CREATE TABLE "course_start_requests" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "course_id" UUID,
    "language" VARCHAR(10) NOT NULL,
    "prompt" TEXT NOT NULL,
    "normalized_prompt" TEXT NOT NULL,
    "scope" "CourseStartScope" NOT NULL,
    "course_mode" "CourseMode",
    "canonical_title" TEXT,
    "target_language" VARCHAR(10),
    "generation_status" "GenerationStatus",
    "generation_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_start_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_start_requests_course_id_idx" ON "course_start_requests"("course_id");

-- CreateIndex
CREATE INDEX "course_start_requests_scope_created_at_idx" ON "course_start_requests"("scope", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "course_start_requests_language_normalized_prompt_key" ON "course_start_requests"("language", "normalized_prompt");

-- AddForeignKey
ALTER TABLE "course_start_requests" ADD CONSTRAINT "course_start_requests_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
