/*
  Warnings:

  - You are about to drop the `lesson_sentences` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lesson_words` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "lesson_sentences" DROP CONSTRAINT "lesson_sentences_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_sentences" DROP CONSTRAINT "lesson_sentences_sentence_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_words" DROP CONSTRAINT "lesson_words_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_words" DROP CONSTRAINT "lesson_words_word_id_fkey";

-- AlterTable
ALTER TABLE "steps" ADD COLUMN     "chapter_sentence_id" UUID,
ADD COLUMN     "chapter_word_id" UUID;

-- DropTable
DROP TABLE "lesson_sentences";

-- DropTable
DROP TABLE "lesson_words";

-- CreateTable
CREATE TABLE "chapter_words" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "chapter_id" UUID NOT NULL,
    "source_lesson_id" UUID NOT NULL,
    "word_id" UUID NOT NULL,
    "user_language" VARCHAR(10) NOT NULL,
    "translation" TEXT NOT NULL DEFAULT '',
    "distractors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_sentences" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "chapter_id" UUID NOT NULL,
    "source_lesson_id" UUID NOT NULL,
    "sentence_id" UUID NOT NULL,
    "user_language" VARCHAR(10) NOT NULL,
    "translation" TEXT NOT NULL DEFAULT '',
    "distractors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "translation_distractors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "explanation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_sentences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chapter_words_chapter_id_word_id_idx" ON "chapter_words"("chapter_id", "word_id");

-- CreateIndex
CREATE INDEX "chapter_words_word_id_idx" ON "chapter_words"("word_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_words_source_lesson_id_word_id_key" ON "chapter_words"("source_lesson_id", "word_id");

-- CreateIndex
CREATE INDEX "chapter_sentences_chapter_id_sentence_id_idx" ON "chapter_sentences"("chapter_id", "sentence_id");

-- CreateIndex
CREATE INDEX "chapter_sentences_sentence_id_idx" ON "chapter_sentences"("sentence_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_sentences_source_lesson_id_sentence_id_key" ON "chapter_sentences"("source_lesson_id", "sentence_id");

-- CreateIndex
CREATE INDEX "steps_chapter_word_id_idx" ON "steps"("chapter_word_id");

-- CreateIndex
CREATE INDEX "steps_chapter_sentence_id_idx" ON "steps"("chapter_sentence_id");

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_chapter_word_id_fkey" FOREIGN KEY ("chapter_word_id") REFERENCES "chapter_words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_chapter_sentence_id_fkey" FOREIGN KEY ("chapter_sentence_id") REFERENCES "chapter_sentences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_words" ADD CONSTRAINT "chapter_words_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_words" ADD CONSTRAINT "chapter_words_source_lesson_id_fkey" FOREIGN KEY ("source_lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_words" ADD CONSTRAINT "chapter_words_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_sentences" ADD CONSTRAINT "chapter_sentences_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_sentences" ADD CONSTRAINT "chapter_sentences_source_lesson_id_fkey" FOREIGN KEY ("source_lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_sentences" ADD CONSTRAINT "chapter_sentences_sentence_id_fkey" FOREIGN KEY ("sentence_id") REFERENCES "sentences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
