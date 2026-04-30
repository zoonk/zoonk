import { prisma } from "@zoonk/db";
import { generateAudioForText } from "./generate-audio-for-text";

/**
 * Queries existing Word audio records and generates missing audio via TTS.
 *
 * This is the shared core for vocabulary and sentence-word audio steps. Both
 * need case-insensitive lookup, parallel missing-audio generation, and a result
 * keyed by the original word surface used by the caller.
 */
export async function generateWordAudioUrls(params: {
  organizationId: string;
  orgSlug: string;
  targetLanguage: string;
  words: string[];
}): Promise<Record<string, string>> {
  const { organizationId, orgSlug, targetLanguage, words } = params;

  const existingAudios = await prisma.word.findMany({
    where: {
      audioUrl: { not: null },
      organizationId,
      targetLanguage,
      word: { in: words, mode: "insensitive" },
    },
  });

  const existingAudioByLower = Object.fromEntries(
    existingAudios.flatMap((record) =>
      record.audioUrl ? [[record.word.toLowerCase(), record.audioUrl]] : [],
    ),
  );

  const existingAudioUrls = Object.fromEntries(
    words.flatMap((word) => {
      const audioUrl = existingAudioByLower[word.toLowerCase()];
      return audioUrl ? [[word, audioUrl]] : [];
    }),
  );

  const wordsNeedingAudio = words.filter((word) => !existingAudioByLower[word.toLowerCase()]);
  const results = await Promise.all(
    wordsNeedingAudio.map((word) => generateAudioForText(word, targetLanguage, orgSlug)),
  );

  return {
    ...existingAudioUrls,
    ...Object.fromEntries(results.map((result) => [result.text, result.audioUrl])),
  };
}
