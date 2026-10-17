-- CreateTable
CREATE TABLE "essay_grade_claims" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "local_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "essay_grade_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "essay_grade_claims_user_id_local_date_idx" ON "essay_grade_claims"("user_id", "local_date");

-- AddForeignKey
ALTER TABLE "essay_grade_claims" ADD CONSTRAINT "essay_grade_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
