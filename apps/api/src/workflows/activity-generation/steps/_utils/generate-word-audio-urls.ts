import { prisma } from "@zoonk/db";
import { generateAudioForText } from "./generate-audio-for-text";

/**
 * Queries existing Word audio records and generates missing audio via TTS.
 *
 * This is the shared core for vocabulary and sentence-word audio steps.
 * Both query `prisma.word.findMany`, filter words needing audio,
 * generate missing audio in parallel, and merge the results.
 *
 * Uses case-insensitive matching consistently, like all other word lookups
 * in the workflow (`fetchExistingWordCasing`, `generateWordPronunciations`).
 */
export async function generateWordAudioUrls(params: {
  organizationId: string;
  orgSlug: string;
  targetLanguage: string;
  words: string[];
}): Promise<Record<string, string>> {
  const { organizationId, orgSlug, targetLanguage, words } = params;

  const existingAudios = await prisma.word.findMany({
    select: { audioUrl: true, word: true },
    where: {
      audioUrl: { not: null },
      organizationId,
      targetLanguage,
      word: { in: words, mode: "insensitive" },
    },
  });

  const existingAudioByLower: Record<string, string> = Object.fromEntries(
    existingAudios.flatMap((record) =>
      record.audioUrl ? [[record.word.toLowerCase(), record.audioUrl]] : [],
    ),
  );

  const existingAudioUrls: Record<string, string> = Object.fromEntries(
    words.flatMap((word) => {
      const audioUrl = existingAudioByLower[word.toLowerCase()];
      return audioUrl ? [[word, audioUrl]] : [];
    }),
  );

  const wordsNeedingAudio = words.filter((word) => !existingAudioByLower[word.toLowerCase()]);

  const results = await Promise.all(
    wordsNeedingAudio.map((word) => generateAudioForText(word, targetLanguage, orgSlug)),
  );

  const fulfilled = results.filter((result) => result !== null);

  return {
    ...existingAudioUrls,
    ...Object.fromEntries(fulfilled.map((result) => [result.text, result.audioUrl])),
  };
}
