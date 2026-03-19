-- AlterTable
ALTER TABLE "sentences" ADD COLUMN     "alternative_sentences" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "alternative_translations" TEXT[] DEFAULT ARRAY[]::TEXT[];
