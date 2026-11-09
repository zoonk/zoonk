-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "display_name" TEXT;

-- The names core's defaultDisplayName gives a new goal, which upper-cases in the goal's language (Turkish "i" becomes "İ").
UPDATE "goals" AS g
SET "display_name" = CASE
  WHEN g."kind" = 'exam' AND n."exam_name" <> '' THEN n."exam_name"
  WHEN g."kind" IN ('language', 'learn') AND n."subject" <> '' THEN
    CASE WHEN g."language" = 'tr' AND LEFT(n."subject", 1) = 'i' THEN 'İ' ELSE UPPER(LEFT(n."subject", 1)) END
      || SUBSTRING(n."subject" FROM 2)
  ELSE g."title"
END
FROM (
  SELECT
    "id",
    CASE WHEN jsonb_typeof("details"->'examName') = 'string' THEN BTRIM("details"->>'examName') END AS "exam_name",
    CASE WHEN jsonb_typeof("details"->'subject') = 'string' THEN BTRIM("details"->>'subject') END AS "subject"
  FROM "goals"
) AS n
WHERE n."id" = g."id" AND g."display_name" IS NULL;
