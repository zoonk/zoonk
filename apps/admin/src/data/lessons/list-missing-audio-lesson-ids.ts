import "server-only";
import { prisma } from "@zoonk/db";

type MissingAudioLessonRow = { lessonId: string };

/**
 * Finds lessons whose currently saved alphabet, canonical word, distractor
 * word, or sentence resource still has no audio. The distractor lookup uses SQL
 * because those generated strings intentionally live in arrays rather than a
 * direct Prisma relation to their reusable Word rows.
 */
export async function listMissingAudioLessonIds(): Promise<string[]> {
  const rows = await prisma.$queryRaw<MissingAudioLessonRow[]>`
    SELECT DISTINCT missing_audio.lesson_id AS "lessonId"
    FROM (
      SELECT steps.lesson_id
      FROM steps
      WHERE steps.kind = 'alphabet'
        AND steps.content->>'audioUrl' IS NULL

      UNION ALL

      SELECT chapter_words.source_lesson_id AS lesson_id
      FROM chapter_words
      INNER JOIN words ON words.id = chapter_words.word_id
      WHERE words.audio_url IS NULL

      UNION ALL

      SELECT chapter_sentences.source_lesson_id AS lesson_id
      FROM chapter_sentences
      INNER JOIN sentences ON sentences.id = chapter_sentences.sentence_id
      WHERE sentences.audio_url IS NULL

      UNION ALL

      SELECT chapter_words.source_lesson_id AS lesson_id
      FROM chapter_words
      INNER JOIN lessons ON lessons.id = chapter_words.source_lesson_id
      INNER JOIN chapters ON chapters.id = lessons.chapter_id
      INNER JOIN courses ON courses.id = chapters.course_id
      CROSS JOIN LATERAL unnest(chapter_words.distractors) AS distractor(word)
      INNER JOIN words
        ON words.organization_id = courses.organization_id
        AND words.target_language = courses.target_language
        AND LOWER(words.word) = LOWER(distractor.word)
      WHERE words.audio_url IS NULL

      UNION ALL

      SELECT chapter_sentences.source_lesson_id AS lesson_id
      FROM chapter_sentences
      INNER JOIN lessons ON lessons.id = chapter_sentences.source_lesson_id
      INNER JOIN chapters ON chapters.id = lessons.chapter_id
      INNER JOIN courses ON courses.id = chapters.course_id
      CROSS JOIN LATERAL unnest(chapter_sentences.distractors) AS distractor(word)
      INNER JOIN words
        ON words.organization_id = courses.organization_id
        AND words.target_language = courses.target_language
        AND LOWER(words.word) = LOWER(distractor.word)
      WHERE words.audio_url IS NULL
    ) AS missing_audio
  `;

  return rows.map((row) => row.lessonId);
}
