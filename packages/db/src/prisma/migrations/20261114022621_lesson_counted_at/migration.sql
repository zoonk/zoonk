-- AlterTable
ALTER TABLE "usage_records" ADD COLUMN     "counted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "usage_records_user_id_kind_counted_at_idx" ON "usage_records"("user_id", "kind", "counted_at");
