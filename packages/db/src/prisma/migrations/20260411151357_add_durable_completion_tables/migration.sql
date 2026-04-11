-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "is_regenerating" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "lesson_completions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_completions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "chapter_id" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_completions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_completions_lesson_id_idx" ON "lesson_completions"("lesson_id");

-- CreateIndex
CREATE INDEX "lesson_completions_user_id_completed_at_idx" ON "lesson_completions"("user_id", "completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_completions_user_id_lesson_id_key" ON "lesson_completions"("user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "chapter_completions_chapter_id_idx" ON "chapter_completions"("chapter_id");

-- CreateIndex
CREATE INDEX "chapter_completions_user_id_completed_at_idx" ON "chapter_completions"("user_id", "completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_completions_user_id_chapter_id_key" ON "chapter_completions"("user_id", "chapter_id");

-- CreateIndex
CREATE INDEX "course_completions_course_id_idx" ON "course_completions"("course_id");

-- CreateIndex
CREATE INDEX "course_completions_user_id_completed_at_idx" ON "course_completions"("user_id", "completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "course_completions_user_id_course_id_key" ON "course_completions"("user_id", "course_id");

-- AddForeignKey
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_completions" ADD CONSTRAINT "chapter_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_completions" ADD CONSTRAINT "chapter_completions_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
