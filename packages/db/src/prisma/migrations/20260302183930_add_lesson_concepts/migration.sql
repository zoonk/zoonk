-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "concepts" TEXT[] DEFAULT ARRAY[]::TEXT[];
