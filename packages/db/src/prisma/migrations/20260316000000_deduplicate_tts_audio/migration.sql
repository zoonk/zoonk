-- CreateTable
CREATE TABLE "word_audio" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "target_language" VARCHAR(10) NOT NULL,
    "word" TEXT NOT NULL,
    "audio_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "word_audio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentence_audio" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "target_language" VARCHAR(10) NOT NULL,
    "sentence" TEXT NOT NULL,
    "audio_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentence_audio_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "words" ADD COLUMN "word_audio_id" BIGINT;

-- AlterTable
ALTER TABLE "sentences" ADD COLUMN "sentence_audio_id" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "word_audio_organization_id_target_language_word_key" ON "word_audio"("organization_id", "target_language", "word");

-- CreateIndex
CREATE UNIQUE INDEX "sentence_audio_organization_id_target_language_sentence_key" ON "sentence_audio"("organization_id", "target_language", "sentence");

-- AddForeignKey
ALTER TABLE "word_audio" ADD CONSTRAINT "word_audio_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentence_audio" ADD CONSTRAINT "sentence_audio_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "words" ADD CONSTRAINT "words_word_audio_id_fkey" FOREIGN KEY ("word_audio_id") REFERENCES "word_audio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentences" ADD CONSTRAINT "sentences_sentence_audio_id_fkey" FOREIGN KEY ("sentence_audio_id") REFERENCES "sentence_audio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropColumn (after FK setup)
ALTER TABLE "words" DROP COLUMN "audio_url";

-- DropColumn (after FK setup)
ALTER TABLE "sentences" DROP COLUMN "audio_url";
