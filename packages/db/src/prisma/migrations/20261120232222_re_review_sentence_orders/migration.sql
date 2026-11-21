-- Orders saved before the reviewer's fixed rule are written again: the daily sweep regenerates them.
UPDATE lesson_sentences
SET orders_owed_at = CURRENT_TIMESTAMP,
    other_sentence_orders = '{}',
    other_translation_orders = '{}'
WHERE orders_owed_at IS NULL;

UPDATE library_lessons
SET sentence_orders_attempts = 0
WHERE sentence_orders_attempts > 0;
