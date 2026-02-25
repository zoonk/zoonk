-- Add language suffix to non-English course slugs so that slug alone is unique per org.
-- e.g. "machine-learning" in Portuguese becomes "machine-learning-pt"
UPDATE courses
SET slug = slug || '-' || language
WHERE language != 'en'
  AND slug NOT LIKE '%-' || language;
