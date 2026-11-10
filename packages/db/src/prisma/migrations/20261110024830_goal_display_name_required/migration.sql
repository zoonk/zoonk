-- Goals the previous release created after 20261109210618_goal_display_name get the same name that migration gave
-- older goals and core's defaultDisplayName gives new ones, upper-cased in the goal's language (Turkish "i" becomes "İ").
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
  WHERE "display_name" IS NULL
) AS n
WHERE n."id" = g."id" AND g."display_name" IS NULL;

-- AlterTable
ALTER TABLE "goals" ALTER COLUMN "display_name" SET NOT NULL;
