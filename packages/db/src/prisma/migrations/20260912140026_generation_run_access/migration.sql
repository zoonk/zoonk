-- CreateTable
CREATE TABLE "generation_runs" (
    "id" TEXT NOT NULL,
    "course_id" UUID,
    "course_prompt_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generation_runs_course_id_idx" ON "generation_runs"("course_id");

-- CreateIndex
CREATE INDEX "generation_runs_course_prompt_id_idx" ON "generation_runs"("course_prompt_id");

-- AddForeignKey
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_course_prompt_id_fkey" FOREIGN KEY ("course_prompt_id") REFERENCES "course_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
