-- CreateTable
CREATE TABLE "lesson_completion_receipts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "original_lesson_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_completion_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lesson_completion_receipts_user_id_original_lesson_id_start_key" ON "lesson_completion_receipts"("user_id", "original_lesson_id", "started_at");

-- AddForeignKey
ALTER TABLE "lesson_completion_receipts" ADD CONSTRAINT "lesson_completion_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
