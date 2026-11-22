-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "requested_mock" JSONB;

-- AlterTable
ALTER TABLE "item_sets" ADD COLUMN     "mock_only" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "mock_only" BOOLEAN DEFAULT false;

-- CreateTable
CREATE TABLE "mock_item_uses" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "item_id" UUID,
    "mock_exam_id" UUID NOT NULL,
    "section" SMALLINT NOT NULL,
    "spent_at" TIMESTAMP(3),

    CONSTRAINT "mock_item_uses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mock_item_uses_mock_exam_id_section_idx" ON "mock_item_uses"("mock_exam_id", "section");

-- CreateIndex
CREATE INDEX "mock_item_uses_item_id_idx" ON "mock_item_uses"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "mock_item_uses_user_id_item_id_key" ON "mock_item_uses"("user_id", "item_id");

-- AddForeignKey
ALTER TABLE "mock_item_uses" ADD CONSTRAINT "mock_item_uses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_item_uses" ADD CONSTRAINT "mock_item_uses_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_item_uses" ADD CONSTRAINT "mock_item_uses_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "mock_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
