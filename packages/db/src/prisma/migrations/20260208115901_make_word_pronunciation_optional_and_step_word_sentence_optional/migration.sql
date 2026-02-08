-- AlterTable
ALTER TABLE "steps" ADD COLUMN     "sentence_id" BIGINT,
ADD COLUMN     "word_id" BIGINT;

-- AlterTable
ALTER TABLE "words" ALTER COLUMN "pronunciation" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "steps_word_id_idx" ON "steps"("word_id");

-- CreateIndex
CREATE INDEX "steps_sentence_id_idx" ON "steps"("sentence_id");

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_sentence_id_fkey" FOREIGN KEY ("sentence_id") REFERENCES "sentences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
