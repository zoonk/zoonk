-- AlterTable
ALTER TABLE "language_conversations" ADD COLUMN     "memory_fact_id" UUID;

-- CreateIndex
CREATE INDEX "language_conversations_memory_fact_id_idx" ON "language_conversations"("memory_fact_id");

-- AddForeignKey
ALTER TABLE "language_conversations" ADD CONSTRAINT "language_conversations_memory_fact_id_fkey" FOREIGN KEY ("memory_fact_id") REFERENCES "memory_facts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
