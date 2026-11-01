-- CreateTable
CREATE TABLE "test_out_claims" (
    "key" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_out_claims_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "test_out_claims_user_id_idx" ON "test_out_claims"("user_id");

-- AddForeignKey
ALTER TABLE "test_out_claims" ADD CONSTRAINT "test_out_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
