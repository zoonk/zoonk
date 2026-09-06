-- CreateEnum
CREATE TYPE "LessonQuestionContextKind" AS ENUM ('lesson', 'step', 'mistake');

-- CreateEnum
CREATE TYPE "LessonQuestionStatus" AS ENUM ('pending', 'running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "lesson_question_threads" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "lesson_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_question_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_questions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "thread_id" UUID NOT NULL,
    "step_id" UUID,
    "context_kind" "LessonQuestionContextKind" NOT NULL,
    "context_snapshot" JSONB NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "status" "LessonQuestionStatus" NOT NULL DEFAULT 'pending',
    "generation_revision" INTEGER NOT NULL DEFAULT 0,
    "requested_model" TEXT,
    "model" TEXT,
    "provider" TEXT,
    "finish_reason" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "total_tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_question_threads_lesson_id_idx" ON "lesson_question_threads"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_question_threads_user_id_lesson_id_key" ON "lesson_question_threads"("user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "lesson_questions_thread_id_created_at_idx" ON "lesson_questions"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "lesson_questions_step_id_idx" ON "lesson_questions"("step_id");

-- AddForeignKey
ALTER TABLE "lesson_question_threads" ADD CONSTRAINT "lesson_question_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_question_threads" ADD CONSTRAINT "lesson_question_threads_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_questions" ADD CONSTRAINT "lesson_questions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "lesson_question_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_questions" ADD CONSTRAINT "lesson_questions_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
