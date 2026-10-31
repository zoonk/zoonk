-- AlterTable
ALTER TABLE "live_call_connections" ALTER COLUMN "user_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "access_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_records_created_at_idx" ON "access_records"("created_at");
