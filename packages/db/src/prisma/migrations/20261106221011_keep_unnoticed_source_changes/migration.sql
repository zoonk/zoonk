-- AlterTable
ALTER TABLE "sources" ADD COLUMN     "notice_failures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unnoticed_changed_at" TIMESTAMP(3),
ADD COLUMN     "unnoticed_changes" TEXT,
ADD COLUMN     "unnoticed_from_hash" TEXT,
ADD COLUMN     "unnoticed_revision" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "sources_unnoticed_changed_at_idx" ON "sources"("unnoticed_changed_at");
