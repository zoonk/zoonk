-- DropForeignKey
ALTER TABLE "test_out_claims" DROP CONSTRAINT "test_out_claims_user_id_fkey";

-- CreateTable
CREATE TABLE "test_submission_claims" (
    "key" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_submission_claims_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "test_submission_claims_user_id_idx" ON "test_submission_claims"("user_id");

-- AddForeignKey
ALTER TABLE "test_submission_claims" ADD CONSTRAINT "test_submission_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
