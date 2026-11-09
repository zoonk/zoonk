-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "display_name" TEXT;

UPDATE "goals"
SET "display_name" = CASE
  WHEN "kind" = 'exam' AND jsonb_typeof("details"->'examName') = 'string' AND NULLIF(BTRIM("details"->>'examName'), '') IS NOT NULL
    THEN BTRIM("details"->>'examName')
  WHEN "kind" IN ('language', 'learn') AND jsonb_typeof("details"->'subject') = 'string' AND NULLIF(BTRIM("details"->>'subject'), '') IS NOT NULL
    THEN UPPER(LEFT(BTRIM("details"->>'subject'), 1)) || SUBSTRING(BTRIM("details"->>'subject') FROM 2)
  ELSE "title"
END
WHERE "display_name" IS NULL;
