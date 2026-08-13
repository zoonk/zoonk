import { prisma } from "@zoonk/db";
import { generateAudioForText } from "./generate-audio-for-text";
import { requireCompleteOptionalAudioBatch } from "./optional-audio-generation-error";

type WordAudioContext = { organizationId: string; orgSlug: string; targetLanguage: string };

/**
 * Keeps the first exact word so repeated AI output does not start duplicate TTS work.
 */
function deduplicateWords(words: string[]): string[] {
  return [...new Set(words)];
}

/**
 * Saves each successful clip immediately so a later workflow failure or manual
 * regeneration can reuse it instead of uploading the same word again.
 */
async function generateAndPersistWordAudio({
  context,
  word,
}: {
  context: WordAudioContext;
  word: string;
}): Promise<{ audioUrl: string; text: string } | null> {
  const result = await generateAudioForText({
    language: context.targetLanguage,
    orgSlug: context.orgSlug,
    text: word,
  });

  if (!result) {
    return null;
  }

  await prisma.word.upsert({
    create: {
      audioUrl: result.audioUrl,
      organizationId: context.organizationId,
      targetLanguage: context.targetLanguage,
      word,
    },
    update: { audioUrl: result.audioUrl },
    where: {
      orgWord: {
        organizationId: context.organizationId,
        targetLanguage: context.targetLanguage,
        word,
      },
    },
  });

  return result;
}

/**
 * Queries existing Word audio records and generates missing audio via TTS.
 *
 * This is the shared core for vocabulary and sentence-word audio steps. Both
 * need exact lookup, parallel missing-audio generation, and a result keyed by
 * the original word surface used by the caller.
 */
export async function generateWordAudioUrls(params: {
  organizationId: string;
  orgSlug: string;
  targetLanguage: string;
  words: string[];
}): Promise<Record<string, string>> {
  const { organizationId, orgSlug, targetLanguage, words } = params;

  const existingWords = await prisma.word.findMany({
    where: { organizationId, targetLanguage, word: { in: words } },
  });

  const existingAudioByWord = Object.fromEntries(
    existingWords.flatMap((record) => (record.audioUrl ? [[record.word, record.audioUrl]] : [])),
  );

  const wordsNeedingAudio = deduplicateWords(words.filter((word) => !existingAudioByWord[word]));

  const context = { orgSlug, organizationId, targetLanguage };

  const results = await Promise.allSettled(
    wordsNeedingAudio.map((word) => generateAndPersistWordAudio({ context, word })),
  );

  requireCompleteOptionalAudioBatch({ results, texts: wordsNeedingAudio });

  const generatedAudioByWord = Object.fromEntries(
    results.flatMap((result) =>
      result.status === "fulfilled" && result.value
        ? [[result.value.text, result.value.audioUrl]]
        : [],
    ),
  );

  const audioByWord = { ...existingAudioByWord, ...generatedAudioByWord };

  return Object.fromEntries(
    words.flatMap((word) => {
      const audioUrl = audioByWord[word];
      return audioUrl ? [[word, audioUrl]] : [];
    }),
  );
}
