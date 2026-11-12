-- CreateTable
CREATE TABLE "anonymous_level_tests" (
    "id" UUID NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "target_language" VARCHAR(10) NOT NULL,
    "bank_run_id" TEXT NOT NULL,
    "start_score" DOUBLE PRECISION NOT NULL,
    "answers" JSONB NOT NULL,
    "questions" JSONB NOT NULL,

    CONSTRAINT "anonymous_level_tests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anonymous_level_tests_language_target_language_bank_run_id_idx" ON "anonymous_level_tests"("language", "target_language", "bank_run_id");
