/*
  Warnings:

  - You are about to drop the column `alternative_translations` on the `lesson_sentences` table. All the data in the column will be lost.
  - You are about to drop the column `alternative_translations` on the `lesson_words` table. All the data in the column will be lost.
  - You are about to drop the column `alternative_sentences` on the `sentences` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "lesson_sentences" DROP COLUMN "alternative_translations",
ADD COLUMN     "distractor_unsafe_translations" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "lesson_words" DROP COLUMN "alternative_translations",
ADD COLUMN     "distractor_unsafe_translations" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "sentences" DROP COLUMN "alternative_sentences",
ADD COLUMN     "distractor_unsafe_sentences" TEXT[] DEFAULT ARRAY[]::TEXT[];
