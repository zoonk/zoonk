-- CreateTable
CREATE TABLE "app_attest_keys" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "key_id" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "sign_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_attest_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_attest_keys_key_id_key" ON "app_attest_keys"("key_id");
