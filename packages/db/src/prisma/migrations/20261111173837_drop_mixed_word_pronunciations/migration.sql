-- Lessons used to keep a word's first guide and only add a later lesson's tip and provenance to it,
-- so these rows pair an old guide with a tip written for another one. That later guide wasn't
-- stored anywhere, so drop the pair: the card keeps its audio, and the next lesson that teaches the
-- word writes a new guide and tip together. A row's own writer sets `generated_at` before inserting
-- it, so a later one means another lesson changed it; the minute allows for clock skew.
DELETE FROM "word_pronunciations"
WHERE "generated_at" > "created_at" + INTERVAL '1 minute';
