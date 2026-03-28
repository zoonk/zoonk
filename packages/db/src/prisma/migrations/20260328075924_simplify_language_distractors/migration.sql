-- AlterTable
ALTER TABLE "lesson_sentences" DROP COLUMN "distractor_unsafe_translations",
ADD COLUMN     "distractors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "translation_distractors" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "lesson_words" DROP COLUMN "distractor_unsafe_translations",
ADD COLUMN     "distractors" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "sentences" DROP COLUMN "distractor_unsafe_sentences";
