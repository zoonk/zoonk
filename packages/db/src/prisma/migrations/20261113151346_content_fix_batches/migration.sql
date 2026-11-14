-- AlterEnum
ALTER TYPE "ContentFixStatus" ADD VALUE 'approved';

-- AlterTable
ALTER TABLE "content_fixes" ADD COLUMN     "batch_id" UUID;

-- Each fix proposed before batches is a batch of one.
UPDATE "content_fixes" SET "batch_id" = "id" WHERE "batch_id" IS NULL;

-- CreateIndex
CREATE INDEX "content_fixes_batch_id_idx" ON "content_fixes"("batch_id");
