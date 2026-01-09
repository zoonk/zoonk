-- @param {Int} $1:userId
-- @param {DateTime} $2:since
SELECT
  EXTRACT(DOW FROM date)::int AS "dayOfWeek",
  SUM(correct_answers)::bigint AS correct,
  SUM(incorrect_answers)::bigint AS incorrect
FROM daily_progress
WHERE user_id = $1 AND date >= $2
GROUP BY EXTRACT(DOW FROM date)
HAVING SUM(correct_answers) + SUM(incorrect_answers) > 0;
