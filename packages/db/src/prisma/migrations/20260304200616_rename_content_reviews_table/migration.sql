/*
  Warnings:

  - You are about to drop the `ai_content_reviews` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ai_content_reviews" DROP CONSTRAINT "ai_content_reviews_user_id_fkey";

-- DropTable
DROP TABLE "ai_content_reviews";

-- CreateTable
CREATE TABLE "content_reviews" (
    "id" BIGSERIAL NOT NULL,
    "task_type" TEXT NOT NULL,
    "entity_id" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "content_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_reviews_task_type_idx" ON "content_reviews"("task_type");

-- CreateIndex
CREATE INDEX "content_reviews_task_type_status_idx" ON "content_reviews"("task_type", "status");

-- CreateIndex
CREATE INDEX "content_reviews_user_id_idx" ON "content_reviews"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_reviews_task_type_entity_id_key" ON "content_reviews"("task_type", "entity_id");

-- AddForeignKey
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
