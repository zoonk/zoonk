-- CreateEnum
CREATE TYPE "CourseLevel" AS ENUM ('overview', 'basic', 'intermediate', 'advanced', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2');

-- CreateEnum
CREATE TYPE "CoursePlanDepth" AS ENUM ('overview', 'complete', 'focused');

-- CreateEnum
CREATE TYPE "CourseDiscoveryStatus" AS ENUM ('pending', 'ask', 'ready', 'generating', 'completed', 'blocked', 'failed');

-- DropForeignKey
ALTER TABLE "chapter_completions" DROP CONSTRAINT "chapter_completions_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "course_completions" DROP CONSTRAINT "course_completions_course_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_progress" DROP CONSTRAINT "lesson_progress_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "step_attempts" DROP CONSTRAINT "step_attempts_step_id_fkey";

-- AlterTable
ALTER TABLE "chapter_completions" ADD COLUMN     "content_snapshot" JSONB,
ALTER COLUMN "chapter_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "concept_key" TEXT,
ADD COLUMN     "level" "CourseLevel",
ADD COLUMN     "outcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "prerequisite_ids" UUID[] DEFAULT ARRAY[]::UUID[];

-- AlterTable
ALTER TABLE "course_completions" ADD COLUMN     "content_snapshot" JSONB,
ALTER COLUMN "course_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "content_revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "curriculum_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "discovery_brief" JSONB;

-- AlterTable
ALTER TABLE "lesson_progress" ADD COLUMN     "content_snapshot" JSONB,
ALTER COLUMN "lesson_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "source_lesson_id" UUID;

-- AlterTable
ALTER TABLE "step_attempts" ADD COLUMN     "content_snapshot" JSONB,
ALTER COLUMN "step_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "course_learning_plans" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "goal" TEXT,
    "starting_knowledge" TEXT,
    "depth" "CoursePlanDepth" NOT NULL DEFAULT 'complete',
    "starting_level" "CourseLevel",
    "daily_minutes" INTEGER,
    "hidden_lesson_kinds" "LessonKind"[] DEFAULT ARRAY[]::"LessonKind"[],
    "chapter_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "content_revision" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_learning_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_discoveries" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "prompt" TEXT NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "brief" JSONB,
    "next_question" JSONB,
    "resolution" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "CourseDiscoveryStatus" NOT NULL DEFAULT 'pending',
    "course_id" UUID,
    "generation_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_discoveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracks" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "request" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_courses" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "track_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "track_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_generation_grants" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_generation_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_learning_plans_course_id_idx" ON "course_learning_plans"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_learning_plans_user_id_course_id_key" ON "course_learning_plans"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "course_discoveries_user_id_updated_at_idx" ON "course_discoveries"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "course_discoveries_course_id_idx" ON "course_discoveries"("course_id");

-- CreateIndex
CREATE INDEX "tracks_user_id_updated_at_idx" ON "tracks"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "track_courses_course_id_idx" ON "track_courses"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "track_courses_track_id_course_id_key" ON "track_courses"("track_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "track_courses_track_id_position_key" ON "track_courses"("track_id", "position");

-- CreateIndex
CREATE INDEX "chapter_generation_grants_chapter_id_idx" ON "chapter_generation_grants"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_generation_grants_user_id_chapter_id_key" ON "chapter_generation_grants"("user_id", "chapter_id");

-- AddForeignKey
ALTER TABLE "course_learning_plans" ADD CONSTRAINT "course_learning_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_learning_plans" ADD CONSTRAINT "course_learning_plans_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_discoveries" ADD CONSTRAINT "course_discoveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_discoveries" ADD CONSTRAINT "course_discoveries_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_courses" ADD CONSTRAINT "track_courses_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_courses" ADD CONSTRAINT "track_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_generation_grants" ADD CONSTRAINT "chapter_generation_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_generation_grants" ADD CONSTRAINT "chapter_generation_grants_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_source_lesson_id_fkey" FOREIGN KEY ("source_lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_completions" ADD CONSTRAINT "chapter_completions_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_attempts" ADD CONSTRAINT "step_attempts_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
