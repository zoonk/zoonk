-- CreateTable
CREATE TABLE "language_skill_graphs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "prompt_key" TEXT NOT NULL,
    "graph" JSONB NOT NULL,
    "primary_course_id" UUID,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_skill_graphs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "language_skill_graphs_prompt_key_key" ON "language_skill_graphs"("prompt_key");

-- CreateIndex
CREATE INDEX "language_skill_graphs_primary_course_id_idx" ON "language_skill_graphs"("primary_course_id");

-- AddForeignKey
ALTER TABLE "language_skill_graphs" ADD CONSTRAINT "language_skill_graphs_primary_course_id_fkey" FOREIGN KEY ("primary_course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
