-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "check_owed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "media_assets_check_owed_at_idx" ON "media_assets"("check_owed_at");
