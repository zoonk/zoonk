/*
  Warnings:

  - The values [pronunciation] on the enum `ActivityKind` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ActivityKind_new" AS ENUM ('custom', 'background', 'explanation', 'quiz', 'mechanics', 'examples', 'story', 'challenge', 'vocabulary', 'grammar', 'reading', 'listening', 'review');
ALTER TABLE "public"."activities" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "activities" ALTER COLUMN "kind" TYPE "ActivityKind_new" USING ("kind"::text::"ActivityKind_new");
ALTER TYPE "ActivityKind" RENAME TO "ActivityKind_old";
ALTER TYPE "ActivityKind_new" RENAME TO "ActivityKind";
DROP TYPE "public"."ActivityKind_old";
ALTER TABLE "activities" ALTER COLUMN "kind" SET DEFAULT 'custom';
COMMIT;

-- CreateTable
CREATE TABLE "words" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "target_language" VARCHAR(10) NOT NULL,
    "user_language" VARCHAR(10) NOT NULL,
    "word" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "pronunciation" TEXT NOT NULL,
    "romanization" TEXT,
    "audio_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentences" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "target_language" VARCHAR(10) NOT NULL,
    "user_language" VARCHAR(10) NOT NULL,
    "sentence" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "romanization" TEXT,
    "audio_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_words" (
    "id" BIGSERIAL NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "word_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_sentences" (
    "id" BIGSERIAL NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "sentence_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_sentences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "words_organization_id_target_language_user_language_idx" ON "words"("organization_id", "target_language", "user_language");

-- CreateIndex
CREATE UNIQUE INDEX "words_organization_id_target_language_user_language_word_key" ON "words"("organization_id", "target_language", "user_language", "word");

-- CreateIndex
CREATE INDEX "sentences_organization_id_target_language_user_language_idx" ON "sentences"("organization_id", "target_language", "user_language");

-- CreateIndex
CREATE UNIQUE INDEX "sentences_organization_id_target_language_user_language_sen_key" ON "sentences"("organization_id", "target_language", "user_language", "sentence");

-- CreateIndex
CREATE INDEX "lesson_words_lesson_id_idx" ON "lesson_words"("lesson_id");

-- CreateIndex
CREATE INDEX "lesson_words_word_id_idx" ON "lesson_words"("word_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_words_lesson_id_word_id_key" ON "lesson_words"("lesson_id", "word_id");

-- CreateIndex
CREATE INDEX "lesson_sentences_lesson_id_idx" ON "lesson_sentences"("lesson_id");

-- CreateIndex
CREATE INDEX "lesson_sentences_sentence_id_idx" ON "lesson_sentences"("sentence_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_sentences_lesson_id_sentence_id_key" ON "lesson_sentences"("lesson_id", "sentence_id");

-- AddForeignKey
ALTER TABLE "words" ADD CONSTRAINT "words_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentences" ADD CONSTRAINT "sentences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_words" ADD CONSTRAINT "lesson_words_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_words" ADD CONSTRAINT "lesson_words_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_sentences" ADD CONSTRAINT "lesson_sentences_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_sentences" ADD CONSTRAINT "lesson_sentences_sentence_id_fkey" FOREIGN KEY ("sentence_id") REFERENCES "sentences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
