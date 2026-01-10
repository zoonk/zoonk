-- @param {Int} $1:userId
-- @param {DateTime} $2:startDate
-- @param {DateTime} $3:endDate
SELECT
  DATE_TRUNC('month', date)::date AS "monthStart",
  AVG(energy_at_end)::float AS energy
FROM daily_progress
WHERE user_id = $1 AND date >= $2 AND date <= $3
GROUP BY DATE_TRUNC('month', date)
ORDER BY "monthStart" ASC;
