-- @param {Int} $1:userId
-- @param {DateTime} $2:since
SELECT
  CASE
    WHEN hour_of_day BETWEEN 0 AND 5 THEN 0
    WHEN hour_of_day BETWEEN 6 AND 11 THEN 1
    WHEN hour_of_day BETWEEN 12 AND 17 THEN 2
    ELSE 3
  END AS "period",
  COUNT(*) FILTER (WHERE is_correct = true)::bigint AS correct,
  COUNT(*) FILTER (WHERE is_correct = false)::bigint AS incorrect
FROM step_attempts
WHERE user_id = $1 AND answered_at >= $2
GROUP BY 1
HAVING COUNT(*) FILTER (WHERE is_correct = true) + COUNT(*) FILTER (WHERE is_correct = false) > 0;
