-- AlterTable
ALTER TABLE "sources" ADD COLUMN     "has_readable_text" BOOLEAN
GENERATED ALWAYS AS (
  COALESCE(regexp_replace("extracted_text" COLLATE "pg_catalog"."pg_unicode_fast", '\[illegible\]', '', 'gi')
    ~ '[[:alnum:]]', false)
) STORED NOT NULL;
