-- CreateTable
CREATE TABLE "ai_content_reviews" (
    "id" BIGSERIAL NOT NULL,
    "task_type" TEXT NOT NULL,
    "entity_id" BIGINT NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "ai_content_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_content_reviews_task_type_idx" ON "ai_content_reviews"("task_type");

-- CreateIndex
CREATE INDEX "ai_content_reviews_user_id_idx" ON "ai_content_reviews"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_content_reviews_task_type_entity_id_key" ON "ai_content_reviews"("task_type", "entity_id");

-- AddForeignKey
ALTER TABLE "ai_content_reviews" ADD CONSTRAINT "ai_content_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
