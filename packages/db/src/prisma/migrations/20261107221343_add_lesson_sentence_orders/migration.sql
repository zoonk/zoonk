-- AlterTable
ALTER TABLE "lesson_sentences" ADD COLUMN     "other_sentence_orders" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "other_translation_orders" TEXT[] DEFAULT ARRAY[]::TEXT[];
