-- Identity keys used to drop "+" and "#", so "C++", "C#" and "C" shared one key. Each row named
-- with them moves to the key the app now builds from its name. A row stays where it is when its
-- name doesn't build its stored key the old way (renamed since, or read differently here), when
-- its new key would be long enough to be hashed, or when another row holds or also wants that key.
CREATE FUNCTION pg_temp.identity_words(value text, spell_out boolean) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(word[1], '-' ORDER BY position), '')
  FROM (
    SELECT normalize(regexp_replace(normalize(value, NFD), '[̀-ͯ]', '', 'g'), NFC) AS accentless
  ) AS source
  CROSS JOIN LATERAL regexp_matches(
    lower(
      CASE WHEN spell_out
        THEN regexp_replace(replace(accentless, '+', ' plus '), '([[:alnum:]])#', '\1 sharp ', 'g')
        ELSE accentless
      END
    ),
    '[[:alnum:]]+',
    'g'
  ) WITH ORDINALITY AS words(word, position)
$$;

CREATE FUNCTION pg_temp.respelled_key(identity_key text, value text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT left(identity_key, length(identity_key) - length(old_words)) || new_words
  FROM (
    SELECT pg_temp.identity_words(value, false) AS old_words,
      pg_temp.identity_words(value, true) AS new_words
  ) AS words
  WHERE old_words <> ''
    AND old_words <> new_words
    AND right(identity_key, length(old_words) + 1) = ':' || old_words
    AND octet_length(identity_key) - octet_length(old_words) + octet_length(new_words) <= 200
$$;

CREATE FUNCTION pg_temp.words_hash(value text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT left(encode(sha256(convert_to(value, 'UTF8')), 'hex'), 40)
$$;

WITH moved AS (
  SELECT id, language, pg_temp.respelled_key(identity_key, name) AS identity_key
  FROM skills
  WHERE name ~ '[+#]'
)
UPDATE skills AS skill
SET identity_key = moved.identity_key
FROM moved
WHERE skill.id = moved.id
  AND moved.identity_key IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM skills AS taken
    WHERE taken.language = moved.language AND taken.identity_key = moved.identity_key
  )
  AND NOT EXISTS (
    SELECT 1 FROM moved AS twin
    WHERE twin.id <> moved.id AND twin.language = moved.language AND twin.identity_key = moved.identity_key
  );

WITH moved AS (
  SELECT id, language, pg_temp.respelled_key(identity_key, title) AS identity_key
  FROM library_chapters
  WHERE title ~ '[+#]'
)
UPDATE library_chapters AS chapter
SET identity_key = moved.identity_key
FROM moved
WHERE chapter.id = moved.id
  AND moved.identity_key IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM library_chapters AS taken
    WHERE taken.language = moved.language AND taken.identity_key = moved.identity_key
  )
  AND NOT EXISTS (
    SELECT 1 FROM moved AS twin
    WHERE twin.id <> moved.id AND twin.language = moved.language AND twin.identity_key = moved.identity_key
  );

WITH moved AS (
  SELECT id, language, pg_temp.respelled_key(identity_key, title) AS identity_key
  FROM library_lessons
  WHERE title ~ '[+#]'
)
UPDATE library_lessons AS lesson
SET identity_key = moved.identity_key
FROM moved
WHERE lesson.id = moved.id
  AND moved.identity_key IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM library_lessons AS taken
    WHERE taken.language = moved.language AND taken.identity_key = moved.identity_key
  )
  AND NOT EXISTS (
    SELECT 1 FROM moved AS twin
    WHERE twin.id <> moved.id AND twin.language = moved.language AND twin.identity_key = moved.identity_key
  );

WITH moved AS (
  SELECT id, language,
    pg_temp.respelled_key(identity_key, concat_ws(' ', name, nullif(role, ''))) AS identity_key
  FROM exam_blueprints
  WHERE name ~ '[+#]' OR role ~ '[+#]'
)
UPDATE exam_blueprints AS blueprint
SET identity_key = moved.identity_key
FROM moved
WHERE blueprint.id = moved.id
  AND moved.identity_key IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM exam_blueprints AS taken
    WHERE taken.language = moved.language AND taken.identity_key = moved.identity_key
  )
  AND NOT EXISTS (
    SELECT 1 FROM moved AS twin
    WHERE twin.id <> moved.id AND twin.language = moved.language AND twin.identity_key = moved.identity_key
  );

-- A picture's key ends with the hash of its prompt's words.
WITH moved AS (
  SELECT asset.id,
    left(asset.reuse_key, length(asset.reuse_key) - 40) || pg_temp.words_hash(words.new_words) AS reuse_key
  FROM media_assets AS asset
  CROSS JOIN LATERAL (
    SELECT pg_temp.identity_words(asset.prompt, false) AS old_words,
      pg_temp.identity_words(asset.prompt, true) AS new_words
  ) AS words
  WHERE asset.kind = 'image'
    AND asset.prompt ~ '[+#]'
    AND words.old_words <> words.new_words
    AND asset.reuse_key LIKE '%image:%'
    AND right(asset.reuse_key, 40) = pg_temp.words_hash(words.old_words)
)
UPDATE media_assets AS asset
SET reuse_key = moved.reuse_key
FROM moved
WHERE asset.id = moved.id
  AND NOT EXISTS (SELECT 1 FROM media_assets AS taken WHERE taken.reuse_key = moved.reuse_key)
  AND NOT EXISTS (
    SELECT 1 FROM moved AS twin WHERE twin.id <> moved.id AND twin.reuse_key = moved.reuse_key
  );

-- A deck's key comes from a general goal nothing stores, so a deck written for a goal named with
-- the symbols leaves the shared keys: goals keep theirs, and the next learner gets a new one.
UPDATE warm_ups AS deck
SET identity_key = 'retired:' || deck.id
WHERE EXISTS (
  SELECT 1 FROM goals AS goal
  WHERE goal.warm_up_id = deck.id
    AND (
      pg_temp.identity_words(goal.title, false) <> pg_temp.identity_words(goal.title, true)
      OR pg_temp.identity_words(goal.display_name, false)
        <> pg_temp.identity_words(goal.display_name, true)
    )
);

DROP FUNCTION pg_temp.words_hash(text);
DROP FUNCTION pg_temp.respelled_key(text, text);
DROP FUNCTION pg_temp.identity_words(text, boolean);
