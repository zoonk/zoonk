-- Phase 1: Create word_pronunciations table
-- Pronunciation is user-language-specific but not lesson-specific.
-- See WordPronunciation model comment for full rationale.

CREATE TABLE "word_pronunciations" (
    "id" BIGSERIAL NOT NULL,
    "word_id" BIGINT NOT NULL,
    "user_language" VARCHAR(10) NOT NULL,
    "pronunciation" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "word_pronunciations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "word_pronunciations_word_id_user_language_key" ON "word_pronunciations"("word_id", "user_language");
CREATE INDEX "word_pronunciations_word_id_idx" ON "word_pronunciations"("word_id");

ALTER TABLE "word_pronunciations" ADD CONSTRAINT "word_pronunciations_word_id_fkey"
    FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 2: Add translation columns to lesson_words
-- Translations are lesson-scoped because the same word can have different
-- meanings in different lessons (e.g. "banco" = "bank" vs "bench").

ALTER TABLE "lesson_words" ADD COLUMN "user_language" VARCHAR(10) NOT NULL DEFAULT '';
ALTER TABLE "lesson_words" ADD COLUMN "translation" TEXT NOT NULL DEFAULT '';
ALTER TABLE "lesson_words" ADD COLUMN "alternative_translations" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Phase 3: Add translation columns to lesson_sentences
-- Follows the same lesson-scoped pattern as lesson_words.

ALTER TABLE "lesson_sentences" ADD COLUMN "user_language" VARCHAR(10) NOT NULL DEFAULT '';
ALTER TABLE "lesson_sentences" ADD COLUMN "translation" TEXT NOT NULL DEFAULT '';
ALTER TABLE "lesson_sentences" ADD COLUMN "alternative_translations" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "lesson_sentences" ADD COLUMN "explanation" TEXT;

-- Phase 4: Migrate pronunciation data from word_translations to word_pronunciations

INSERT INTO "word_pronunciations" ("word_id", "user_language", "pronunciation", "created_at")
SELECT DISTINCT ON ("word_id", "user_language")
    "word_id",
    "user_language",
    "pronunciation",
    "created_at"
FROM "word_translations"
WHERE "pronunciation" IS NOT NULL
ORDER BY "word_id", "user_language", "updated_at" DESC;

-- Phase 5: Migrate translation data from word_translations to lesson_words

UPDATE "lesson_words" lw
SET
    "user_language" = wt."user_language",
    "translation" = wt."translation",
    "alternative_translations" = wt."alternative_translations"
FROM "word_translations" wt
WHERE wt."word_id" = lw."word_id";

-- Phase 6: Migrate translation data from sentence_translations to lesson_sentences

UPDATE "lesson_sentences" ls
SET
    "user_language" = st."user_language",
    "translation" = st."translation",
    "alternative_translations" = st."alternative_translations",
    "explanation" = st."explanation"
FROM "sentence_translations" st
WHERE st."sentence_id" = ls."sentence_id";

-- Phase 7: Drop old translation tables

DROP TABLE "word_translations";
DROP TABLE "sentence_translations";
