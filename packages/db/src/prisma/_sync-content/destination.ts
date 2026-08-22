import { logInfo } from "@zoonk/utils/logger";
import { type Client } from "pg";

export async function assertDestinationContentIsolation({
  destination,
  organizationId,
}: {
  destination: Client;
  organizationId: string;
}): Promise<void> {
  const result = await destination.query<{ has_external_references: boolean }>(
    `WITH catalog_courses AS (
       SELECT id FROM courses WHERE organization_id = $1
     ), catalog_chapters AS (
       SELECT id FROM chapters WHERE course_id = ANY(ARRAY(SELECT id FROM catalog_courses))
     ), catalog_lessons AS (
       SELECT id FROM lessons WHERE chapter_id = ANY(ARRAY(SELECT id FROM catalog_chapters))
     )
     SELECT EXISTS (
       SELECT chapter_words.id
         FROM chapter_words
         JOIN words ON words.id = chapter_words.word_id
        WHERE words.organization_id = $1
          AND chapter_words.chapter_id <> ALL(ARRAY(SELECT id FROM catalog_chapters))
       UNION ALL
       SELECT chapter_sentences.id
         FROM chapter_sentences
         JOIN sentences ON sentences.id = chapter_sentences.sentence_id
        WHERE sentences.organization_id = $1
          AND chapter_sentences.chapter_id <> ALL(ARRAY(SELECT id FROM catalog_chapters))
       UNION ALL
       SELECT steps.id
         FROM steps
        WHERE (steps.word_id = ANY(ARRAY(SELECT id FROM words WHERE organization_id = $1))
           OR steps.sentence_id = ANY(ARRAY(SELECT id FROM sentences WHERE organization_id = $1)))
          AND steps.lesson_id <> ALL(ARRAY(SELECT id FROM catalog_lessons))
     ) AS has_external_references`,
    [organizationId],
  );

  if (result.rows[0]?.has_external_references) {
    throw new Error("Local AI vocabulary is referenced by content outside the AI catalog");
  }
}

export async function clearDestinationContent({
  destination,
  organizationId,
}: {
  destination: Client;
  organizationId: string;
}): Promise<void> {
  const courses = await destination.query("DELETE FROM courses WHERE organization_id = $1", [
    organizationId,
  ]);

  const words = await destination.query("DELETE FROM words WHERE organization_id = $1", [
    organizationId,
  ]);

  const sentences = await destination.query("DELETE FROM sentences WHERE organization_id = $1", [
    organizationId,
  ]);

  logInfo(
    `Removed ${courses.rowCount ?? 0} courses, ${words.rowCount ?? 0} words, and ${sentences.rowCount ?? 0} sentences from local zoonk`,
  );
}
