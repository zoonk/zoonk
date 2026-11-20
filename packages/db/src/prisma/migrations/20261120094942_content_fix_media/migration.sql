-- AlterEnum
ALTER TYPE "FollowUpKind" ADD VALUE 'prepare_content_fix_media';

-- AlterTable
ALTER TABLE "content_fixes" ADD COLUMN     "media" JSONB;

-- Keep single-clip writes from the outgoing release readable until it is retired.
CREATE FUNCTION copy_content_fix_voice_to_media() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  clip_model text;
  clip_text text;
  clip_language text;
  clip_org text;
  clip_key text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.media IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.voice IS NULL AND NEW.voice_owed_at IS NULL THEN
    NEW.media := '[]'::jsonb;
    RETURN NEW;
  END IF;

  IF NEW.unit = 'word' THEN
    clip_model := 'Word';
    SELECT w.target_language, o.slug INTO clip_language, clip_org
    FROM words w JOIN organizations o ON o.id = w.organization_id WHERE w.id = NEW.unit_id;
  ELSIF NEW.unit = 'sentence' THEN
    clip_model := 'Sentence';
    SELECT s.target_language, o.slug INTO clip_language, clip_org
    FROM sentences s JOIN organizations o ON o.id = s.organization_id WHERE s.id = NEW.unit_id;
  ELSE
    NEW.media := '[]'::jsonb;
    RETURN NEW;
  END IF;

  SELECT COALESCE(c->>'text', f->>'after') INTO clip_text
  FROM jsonb_array_elements(NEW.changes) AS c
  LEFT JOIN LATERAL jsonb_array_elements(c->'fields') AS f
    ON f->>'field' = NEW.unit::text
  WHERE c->>'model' = clip_model
    AND (c->>'op' = 'revoice' OR f IS NOT NULL)
  LIMIT 1;

  clip_text := COALESCE(NEW.voice->>'text', clip_text, '');
  clip_language := COALESCE(clip_language, '');
  clip_key := concat_ws(':', clip_model, clip_language, clip_text);

  NEW.media := jsonb_build_array(jsonb_build_object(
    'need', jsonb_strip_nulls(jsonb_build_object(
      'kind', 'clip', 'key', clip_key, 'model', clip_model,
      'language', clip_language, 'text', clip_text, 'orgSlug', clip_org
    )),
    'result', CASE
      WHEN NEW.voice->>'status' = 'voiced' THEN jsonb_build_object(
        'kind', 'clip', 'key', clip_key,
        'url', NEW.voice->'url', 'provenance', NEW.voice->'provenance'
      )
      WHEN NEW.voice->>'status' = 'failed' OR clip_org IS NULL OR clip_text = ''
        THEN '"failed"'::jsonb
      ELSE 'null'::jsonb
    END
  ));
  RETURN NEW;
END;
$$;

CREATE TRIGGER content_fix_voice_to_media
BEFORE INSERT OR UPDATE OF voice ON content_fixes
FOR EACH ROW EXECUTE FUNCTION copy_content_fix_voice_to_media();

UPDATE content_fixes SET voice = voice WHERE media IS NULL;
