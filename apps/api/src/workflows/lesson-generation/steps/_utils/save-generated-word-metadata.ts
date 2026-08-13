import { upsertWordWithPronunciation } from "./upsert-word-with-pronunciation";

export type GeneratedWordMetadata = {
  audioUrl: string | null;
  pronunciation: string | null;
  romanization: string | null;
  romanizationUpdate: { romanization?: string | null };
  word: string;
};

/** Saves one generated word without collapsing case-sensitive vocabulary. */
async function saveReusableWord({
  entry,
  organizationId,
  targetLanguage,
  userLanguage,
}: {
  entry: GeneratedWordMetadata;
  organizationId: string;
  targetLanguage: string;
  userLanguage: string;
}): Promise<readonly [string, string]> {
  const wordId = await upsertWordWithPronunciation({
    audioUrl: entry.audioUrl,
    organizationId,
    pronunciation: entry.pronunciation,
    romanization: entry.romanization,
    romanizationUpdate: entry.romanizationUpdate,
    targetLanguage,
    userLanguage,
    word: entry.word,
  });

  return [entry.word, wordId] as const;
}

/**
 * Saves reusable word metadata before the short lesson-structure transaction.
 * These rows are shared across lessons, so a later lesson save retry can safely
 * reuse them without exposing a partial lesson or holding the chapter-order lock.
 */
export async function saveGeneratedWordMetadata({
  organizationId,
  targetLanguage,
  userLanguage,
  words,
}: {
  organizationId: string;
  targetLanguage: string;
  userLanguage: string;
  words: GeneratedWordMetadata[];
}): Promise<Record<string, string>> {
  const savedWords = await Promise.all(
    words.map((entry) => saveReusableWord({ entry, organizationId, targetLanguage, userLanguage })),
  );

  return Object.fromEntries(savedWords);
}
