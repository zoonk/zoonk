-- CreateTable
CREATE TABLE "course_generation_runs" (
    "id" SERIAL NOT NULL,
    "run_id" VARCHAR(100) NOT NULL,
    "course_suggestion_id" INTEGER NOT NULL,
    "course_id" INTEGER,
    "title" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'running',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_generation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_generation_runs_run_id_key" ON "course_generation_runs"("run_id");

-- CreateIndex
CREATE INDEX "course_generation_runs_course_suggestion_id_idx" ON "course_generation_runs"("course_suggestion_id");

-- CreateIndex
CREATE INDEX "course_generation_runs_course_id_idx" ON "course_generation_runs"("course_id");

-- CreateIndex
CREATE INDEX "course_generation_runs_status_idx" ON "course_generation_runs"("status");

-- AddForeignKey
ALTER TABLE "course_generation_runs" ADD CONSTRAINT "course_generation_runs_course_suggestion_id_fkey" FOREIGN KEY ("course_suggestion_id") REFERENCES "course_suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_generation_runs" ADD CONSTRAINT "course_generation_runs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
