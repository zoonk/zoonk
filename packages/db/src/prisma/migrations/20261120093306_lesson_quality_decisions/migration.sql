-- CreateEnum
CREATE TYPE "LessonQualityPhase" AS ENUM ('codeCheck', 'codeRecheck', 'firstReview', 'recheck', 'disposition');

-- CreateEnum
CREATE TYPE "LessonQualityOutcome" AS ENUM ('needsFix', 'passed', 'publishUnchecked', 'staged', 'published', 'heldBack', 'setAside');

-- CreateTable
CREATE TABLE "lesson_quality_decisions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "lesson_id" UUID NOT NULL,
    "attempt_key" TEXT NOT NULL,
    "version" SMALLINT,
    "phase" "LessonQualityPhase" NOT NULL,
    "outcome" "LessonQualityOutcome" NOT NULL,
    "writer_run_id" TEXT NOT NULL,
    "reviewer_run_id" TEXT,
    "blocking" JSONB NOT NULL,
    "minor" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_quality_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_quality_decisions_phase_created_at_idx" ON "lesson_quality_decisions"("phase", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_quality_decisions_lesson_id_attempt_key_phase_key" ON "lesson_quality_decisions"("lesson_id", "attempt_key", "phase");

-- AddForeignKey
ALTER TABLE "lesson_quality_decisions" ADD CONSTRAINT "lesson_quality_decisions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "library_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
