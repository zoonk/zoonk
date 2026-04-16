import { prisma } from "@zoonk/db";

/**
 * Upserts a Word record and its WordPronunciation in one call.
 *
 * Four places across two save files (vocabulary and reading) repeat the same
 * Word upsert + WordPronunciation upsert pattern. This utility eliminates
 * that duplication while letting each caller control the romanization update
 * strategy via `romanizationUpdate`:
 *
 * - Vocabulary passes `romanization ? { romanization } : {}` (update only if truthy).
 * - Reading canonical passes `{ romanization }` (always overwrite, even with null).
 * - Reading distractor passes the result of `getRomanizationUpdate(metadata)`.
 *
 * Returns the Word record ID so callers can use it for LessonWord or Step writes.
 */
export async function upsertWordWithPronunciation(params: {
  audioUrl: string | null;
  organizationId: string;
  pronunciation: string | null;
  romanization: string | null;
  romanizationUpdate: { romanization?: string | null };
  targetLanguage: string;
  userLanguage: string;
  word: string;
}): Promise<string> {
  const {
    audioUrl,
    organizationId,
    pronunciation,
    romanization,
    romanizationUpdate,
    targetLanguage,
    userLanguage,
    word,
  } = params;

  const record = await prisma.word.upsert({
    create: {
      audioUrl,
      organizationId,
      romanization,
      targetLanguage,
      word,
    },
    update: {
      ...(audioUrl ? { audioUrl } : {}),
      ...romanizationUpdate,
    },
    where: {
      orgWord: { organizationId, targetLanguage, word },
    },
  });

  if (pronunciation) {
    await prisma.wordPronunciation.upsert({
      create: { pronunciation, userLanguage, wordId: record.id },
      update: { pronunciation },
      where: { wordPronunciation: { userLanguage, wordId: record.id } },
    });
  }

  return record.id;
}
