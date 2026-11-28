-- Identity keys used to drop "+" and "#", so "C++", "C#" and "C" shared one key. A row named with
-- them moves to the key the app now builds from its name when that name still builds its stored key
-- the old way. When it can't move (another row holds or also wants the key, or the key would be long
-- enough to be hashed), it's retired from exact matches, so a plain "C" name never reaches it. Rows
-- whose name doesn't build their stored key (renamed since, or keyed by something else) stay.
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
$$;

-- The length JavaScript measures, which decides when a key is replaced by its hash.
CREATE FUNCTION pg_temp.utf16_length(value text) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT 2 * char_length(value) - char_length(regexp_replace(value, '[\U00010000-\U0010FFFF]', '', 'g'))
$$;

CREATE FUNCTION pg_temp.words_hash(value text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT left(encode(sha256(convert_to(value, 'UTF8')), 'hex'), 40)
$$;

WITH named AS (
  SELECT id, language, identity_key, pg_temp.respelled_key(identity_key, name) AS respelled
  FROM skills
  WHERE name ~ '[+#]'
), target AS (
  SELECT named.id,
    CASE
      WHEN pg_temp.utf16_length(named.respelled) <= 200
        AND NOT EXISTS (
          SELECT 1 FROM skills AS taken
          WHERE taken.language = named.language AND taken.identity_key = named.respelled
        )
        AND NOT EXISTS (
          SELECT 1 FROM named AS twin
          WHERE twin.id <> named.id AND twin.language = named.language AND twin.respelled = named.respelled
        )
      THEN named.respelled
      ELSE named.identity_key || '#retired'
    END AS identity_key
  FROM named
  WHERE named.respelled IS NOT NULL
)
UPDATE skills AS skill
SET identity_key = target.identity_key
FROM target
WHERE skill.id = target.id;

WITH named AS (
  SELECT id, language, identity_key, pg_temp.respelled_key(identity_key, title) AS respelled
  FROM library_chapters
  WHERE title ~ '[+#]'
), target AS (
  SELECT named.id,
    CASE
      WHEN pg_temp.utf16_length(named.respelled) <= 200
        AND NOT EXISTS (
          SELECT 1 FROM library_chapters AS taken
          WHERE taken.language = named.language AND taken.identity_key = named.respelled
        )
        AND NOT EXISTS (
          SELECT 1 FROM named AS twin
          WHERE twin.id <> named.id AND twin.language = named.language AND twin.respelled = named.respelled
        )
      THEN named.respelled
      ELSE named.identity_key || '#retired'
    END AS identity_key
  FROM named
  WHERE named.respelled IS NOT NULL
)
UPDATE library_chapters AS chapter
SET identity_key = target.identity_key
FROM target
WHERE chapter.id = target.id;

-- Only lessons that split one skill set end their key with their title.
WITH named AS (
  SELECT id, language, identity_key, pg_temp.respelled_key(identity_key, title) AS respelled
  FROM library_lessons
  WHERE title ~ '[+#]'
), target AS (
  SELECT named.id,
    CASE
      WHEN pg_temp.utf16_length(named.respelled) <= 200
        AND NOT EXISTS (
          SELECT 1 FROM library_lessons AS taken
          WHERE taken.language = named.language AND taken.identity_key = named.respelled
        )
        AND NOT EXISTS (
          SELECT 1 FROM named AS twin
          WHERE twin.id <> named.id AND twin.language = named.language AND twin.respelled = named.respelled
        )
      THEN named.respelled
      ELSE named.identity_key || '#retired'
    END AS identity_key
  FROM named
  WHERE named.respelled IS NOT NULL
)
UPDATE library_lessons AS lesson
SET identity_key = target.identity_key
FROM target
WHERE lesson.id = target.id;

WITH named AS (
  SELECT id, language, identity_key,
    pg_temp.respelled_key(identity_key, concat_ws(' ', name, nullif(role, ''))) AS respelled
  FROM exam_blueprints
  WHERE name ~ '[+#]' OR role ~ '[+#]'
), target AS (
  SELECT named.id,
    CASE
      WHEN NOT EXISTS (
          SELECT 1 FROM exam_blueprints AS taken
          WHERE taken.language = named.language AND taken.identity_key = named.respelled
        )
        AND NOT EXISTS (
          SELECT 1 FROM named AS twin
          WHERE twin.id <> named.id AND twin.language = named.language AND twin.respelled = named.respelled
        )
      THEN named.respelled
      ELSE named.identity_key || '#retired'
    END AS identity_key
  FROM named
  WHERE named.respelled IS NOT NULL
)
UPDATE exam_blueprints AS blueprint
SET identity_key = target.identity_key
FROM target
WHERE blueprint.id = target.id;

-- A picture's key ends with the hash of its prompt's words.
WITH named AS (
  SELECT asset.id, asset.reuse_key,
    left(asset.reuse_key, length(asset.reuse_key) - 40) || pg_temp.words_hash(words.new_words) AS respelled
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
), target AS (
  SELECT named.id,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM media_assets AS taken WHERE taken.reuse_key = named.respelled)
        AND NOT EXISTS (
          SELECT 1 FROM named AS twin WHERE twin.id <> named.id AND twin.respelled = named.respelled
        )
      THEN named.respelled
      ELSE named.reuse_key || '#retired'
    END AS reuse_key
  FROM named
)
UPDATE media_assets AS asset
SET reuse_key = target.reuse_key
FROM target
WHERE asset.id = target.id;

-- A deck's key comes from a general goal nothing stores, so a deck written for a goal named with
-- the symbols is retired: goals keep theirs, and the next learner gets a new one.
UPDATE warm_ups AS deck
SET identity_key = deck.identity_key || '#retired'
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
DROP FUNCTION pg_temp.utf16_length(text);
DROP FUNCTION pg_temp.respelled_key(text, text);
DROP FUNCTION pg_temp.identity_words(text, boolean);
