-- Phase 1: Create new translation tables

CREATE TABLE "word_translations" (
    "id" BIGSERIAL NOT NULL,
    "word_id" BIGINT NOT NULL,
    "user_language" VARCHAR(10) NOT NULL,
    "translation" TEXT NOT NULL,
    "alternative_translations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pronunciation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "word_translations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sentence_translations" (
    "id" BIGSERIAL NOT NULL,
    "sentence_id" BIGINT NOT NULL,
    "user_language" VARCHAR(10) NOT NULL,
    "translation" TEXT NOT NULL,
    "alternative_translations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "explanation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentence_translations_pkey" PRIMARY KEY ("id")
);

-- Phase 2: Add audio_url columns to words and sentences

ALTER TABLE "words" ADD COLUMN "audio_url" TEXT;
ALTER TABLE "sentences" ADD COLUMN "audio_url" TEXT;

-- Phase 3: Populate audio_url from audio tables

UPDATE "words" w
SET "audio_url" = wa."audio_url"
FROM "word_audio" wa
WHERE w."word_audio_id" = wa."id";

UPDATE "sentences" s
SET "audio_url" = sa."audio_url"
FROM "sentence_audio" sa
WHERE s."sentence_audio_id" = sa."id";

-- Phase 4: Deduplicate words
-- For each (organization_id, target_language, word) group, keep the row with the lowest id as canonical.

-- 4a: Build a mapping from every word row to its canonical row
CREATE TEMP TABLE word_canonical_map AS
SELECT w."id" AS old_id, canonical."id" AS canonical_id
FROM "words" w
JOIN (
    SELECT MIN("id") AS "id", "organization_id", "target_language", "word"
    FROM "words"
    GROUP BY "organization_id", "target_language", "word"
) canonical
ON w."organization_id" = canonical."organization_id"
AND w."target_language" = canonical."target_language"
AND w."word" = canonical."word";

-- 4b: Populate word_translations from all word rows (including duplicates)
INSERT INTO "word_translations" ("word_id", "user_language", "translation", "alternative_translations", "pronunciation", "created_at", "updated_at")
SELECT DISTINCT ON (wcm.canonical_id, w."user_language")
    wcm.canonical_id,
    w."user_language",
    w."translation",
    w."alternative_translations",
    w."pronunciation",
    w."created_at",
    w."updated_at"
FROM "words" w
JOIN word_canonical_map wcm ON wcm.old_id = w."id"
ORDER BY wcm.canonical_id, w."user_language", w."updated_at" DESC;

-- 4c: Repoint steps.word_id to canonical
UPDATE "steps" s
SET "word_id" = wcm.canonical_id
FROM word_canonical_map wcm
WHERE s."word_id" = wcm.old_id
AND wcm.old_id != wcm.canonical_id;

-- 4d: Repoint lesson_words.word_id to canonical
-- First delete any duplicates that would violate the unique constraint after repointing
DELETE FROM "lesson_words" lw
WHERE EXISTS (
    SELECT 1 FROM word_canonical_map wcm
    WHERE lw."word_id" = wcm.old_id
    AND wcm.old_id != wcm.canonical_id
    AND EXISTS (
        SELECT 1 FROM "lesson_words" lw2
        JOIN word_canonical_map wcm2 ON lw2."word_id" = wcm2.old_id
        WHERE lw2."lesson_id" = lw."lesson_id"
        AND wcm2.canonical_id = wcm.canonical_id
        AND lw2."id" < lw."id"
    )
);

UPDATE "lesson_words" lw
SET "word_id" = wcm.canonical_id
FROM word_canonical_map wcm
WHERE lw."word_id" = wcm.old_id
AND wcm.old_id != wcm.canonical_id;

-- 4e: Delete non-canonical word rows
DELETE FROM "words" w
WHERE EXISTS (
    SELECT 1 FROM word_canonical_map wcm
    WHERE wcm.old_id = w."id"
    AND wcm.old_id != wcm.canonical_id
);

DROP TABLE word_canonical_map;

-- Phase 5: Deduplicate sentences (same pattern)

CREATE TEMP TABLE sentence_canonical_map AS
SELECT s."id" AS old_id, canonical."id" AS canonical_id
FROM "sentences" s
JOIN (
    SELECT MIN("id") AS "id", "organization_id", "target_language", "sentence"
    FROM "sentences"
    GROUP BY "organization_id", "target_language", "sentence"
) canonical
ON s."organization_id" = canonical."organization_id"
AND s."target_language" = canonical."target_language"
AND s."sentence" = canonical."sentence";

-- 5b: Populate sentence_translations
INSERT INTO "sentence_translations" ("sentence_id", "user_language", "translation", "alternative_translations", "explanation", "created_at", "updated_at")
SELECT DISTINCT ON (scm.canonical_id, s."user_language")
    scm.canonical_id,
    s."user_language",
    s."translation",
    s."alternative_translations",
    s."explanation",
    s."created_at",
    s."updated_at"
FROM "sentences" s
JOIN sentence_canonical_map scm ON scm.old_id = s."id"
ORDER BY scm.canonical_id, s."user_language", s."updated_at" DESC;

-- 5c: Repoint steps.sentence_id to canonical
UPDATE "steps" s
SET "sentence_id" = scm.canonical_id
FROM sentence_canonical_map scm
WHERE s."sentence_id" = scm.old_id
AND scm.old_id != scm.canonical_id;

-- 5d: Repoint lesson_sentences to canonical (handle duplicates)
DELETE FROM "lesson_sentences" ls
WHERE EXISTS (
    SELECT 1 FROM sentence_canonical_map scm
    WHERE ls."sentence_id" = scm.old_id
    AND scm.old_id != scm.canonical_id
    AND EXISTS (
        SELECT 1 FROM "lesson_sentences" ls2
        JOIN sentence_canonical_map scm2 ON ls2."sentence_id" = scm2.old_id
        WHERE ls2."lesson_id" = ls."lesson_id"
        AND scm2.canonical_id = scm.canonical_id
        AND ls2."id" < ls."id"
    )
);

UPDATE "lesson_sentences" ls
SET "sentence_id" = scm.canonical_id
FROM sentence_canonical_map scm
WHERE ls."sentence_id" = scm.old_id
AND scm.old_id != scm.canonical_id;

-- 5e: Delete non-canonical sentence rows
DELETE FROM "sentences" s
WHERE EXISTS (
    SELECT 1 FROM sentence_canonical_map scm
    WHERE scm.old_id = s."id"
    AND scm.old_id != scm.canonical_id
);

DROP TABLE sentence_canonical_map;

-- Phase 6: Drop old columns and constraints

-- Drop foreign key constraints first
ALTER TABLE "words" DROP CONSTRAINT IF EXISTS "words_word_audio_id_fkey";
ALTER TABLE "sentences" DROP CONSTRAINT IF EXISTS "sentences_sentence_audio_id_fkey";

-- Drop old unique constraints
ALTER TABLE "words" DROP CONSTRAINT IF EXISTS "words_organization_id_target_language_user_language_word_key";
ALTER TABLE "sentences" DROP CONSTRAINT IF EXISTS "sentences_organization_id_target_language_user_language_sentence_key";

-- Drop old indexes
DROP INDEX IF EXISTS "words_organization_id_target_language_user_language_idx";
DROP INDEX IF EXISTS "sentences_organization_id_target_language_user_language_idx";

-- Drop old columns from words
ALTER TABLE "words" DROP COLUMN "user_language";
ALTER TABLE "words" DROP COLUMN "translation";
ALTER TABLE "words" DROP COLUMN "alternative_translations";
ALTER TABLE "words" DROP COLUMN "pronunciation";
ALTER TABLE "words" DROP COLUMN "word_audio_id";

-- Drop old columns from sentences
ALTER TABLE "sentences" DROP COLUMN "user_language";
ALTER TABLE "sentences" DROP COLUMN "translation";
ALTER TABLE "sentences" DROP COLUMN "alternative_translations";
ALTER TABLE "sentences" DROP COLUMN "explanation";
ALTER TABLE "sentences" DROP COLUMN "sentence_audio_id";

-- Phase 7: Drop audio tables

DROP TABLE "word_audio";
DROP TABLE "sentence_audio";

-- Phase 8: Add new constraints and indexes

-- New unique constraints for canonical records
CREATE UNIQUE INDEX "words_organization_id_target_language_word_key" ON "words"("organization_id", "target_language", "word");
CREATE UNIQUE INDEX "sentence_translations_sentence_id_user_language_key" ON "sentence_translations"("sentence_id", "user_language");
CREATE UNIQUE INDEX "word_translations_word_id_user_language_key" ON "word_translations"("word_id", "user_language");
CREATE UNIQUE INDEX "sentences_organization_id_target_language_sentence_key" ON "sentences"("organization_id", "target_language", "sentence");

-- New indexes
CREATE INDEX "words_organization_id_target_language_idx" ON "words"("organization_id", "target_language");
CREATE INDEX "sentences_organization_id_target_language_idx" ON "sentences"("organization_id", "target_language");
CREATE INDEX "word_translations_word_id_idx" ON "word_translations"("word_id");
CREATE INDEX "sentence_translations_sentence_id_idx" ON "sentence_translations"("sentence_id");

-- Foreign keys for translation tables
ALTER TABLE "word_translations" ADD CONSTRAINT "word_translations_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sentence_translations" ADD CONSTRAINT "sentence_translations_sentence_id_fkey" FOREIGN KEY ("sentence_id") REFERENCES "sentences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
