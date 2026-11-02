-- CreateTable
CREATE TABLE "model_grades" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_grades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "model_grades_user_id_question_id_created_at_idx" ON "model_grades"("user_id", "question_id", "created_at");

-- AddForeignKey
ALTER TABLE "model_grades" ADD CONSTRAINT "model_grades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
