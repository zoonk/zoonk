-- AlterTable
ALTER TABLE "mistakes" ADD COLUMN     "missed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Until now a mistake was ready to practice from the day after it was made.
UPDATE "mistakes" SET "missed_at" = "created_at";

-- An open mistake missed again since (in practice, or on its question in a lesson) waits from that miss.
-- Only the last two days can still be someone's today.
UPDATE "mistakes" AS m
SET "missed_at" = misses."last_miss"
FROM (
  SELECT m2."id", MAX(a."answered_at") AS "last_miss"
  FROM "mistakes" AS m2
  JOIN "attempts" AS a
    ON a."user_id" = m2."user_id"
    AND a."is_correct" = false
    AND a."answered_at" > m2."created_at"
    AND a."answered_at" > NOW() - INTERVAL '2 days'
    AND (
      a."answer"->>'practiceMistakeId' = m2."id"::text
      OR (
        a."answer"->>'practiceMistakeId' IS NULL
        AND (a."item_id" = m2."item_id" OR a."step_id" = m2."step_id")
      )
    )
  WHERE m2."status" = 'open'
  GROUP BY m2."id"
) AS misses
WHERE misses."id" = m."id";
