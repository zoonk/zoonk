-- AlterTable
ALTER TABLE "ai_content_reviews" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'approved';

-- CreateIndex
CREATE INDEX "ai_content_reviews_task_type_status_idx" ON "ai_content_reviews"("task_type", "status");
