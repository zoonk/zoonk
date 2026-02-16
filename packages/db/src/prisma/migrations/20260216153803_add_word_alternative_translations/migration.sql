-- AlterTable
ALTER TABLE "words" ADD COLUMN     "alternative_translations" TEXT[] DEFAULT ARRAY[]::TEXT[];
