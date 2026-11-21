-- Orders saved before the reviewer's fixed rule are written again by the daily sweep. Bumping
-- updated_at changes the cached lesson's version, so cleared orders stop counting at once.
WITH reowed AS (
  UPDATE lesson_sentences
  SET orders_owed_at = CURRENT_TIMESTAMP,
      other_sentence_orders = '{}',
      other_translation_orders = '{}'
  WHERE orders_owed_at IS NULL
  RETURNING lesson_id
)
UPDATE library_lessons
SET sentence_orders_attempts = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (SELECT lesson_id FROM reowed);
