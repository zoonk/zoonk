import { prisma } from "@zoonk/db";
import { normalizePunctuation } from "@zoonk/utils/string";
import { type ReadingLessonContent } from "./generated-lesson-content";

type ReadingSentence = ReadingLessonContent["sentences"][number];

/** Saves one reusable sentence row without holding the chapter-order lock. */
async function saveReusableSentence({
  organizationId,
  sentenceAudioUrls,
  sentenceRomanizations,
  targetLanguage,
  readingSentence,
}: {
  organizationId: string;
  readingSentence: ReadingSentence;
  sentenceAudioUrls: Record<string, string>;
  sentenceRomanizations: Record<string, string>;
  targetLanguage: string;
}): Promise<readonly [string, string]> {
  const sentence = normalizePunctuation(readingSentence.sentence);
  const audioUrl = sentenceAudioUrls[readingSentence.sentence] ?? null;
  const romanization = sentenceRomanizations[readingSentence.sentence] ?? null;

  const record = await prisma.sentence.upsert({
    create: { audioUrl, organizationId, romanization, sentence, targetLanguage },
    update: { ...(audioUrl ? { audioUrl } : {}), ...(romanization ? { romanization } : {}) },
    where: { orgSentence: { organizationId, sentence, targetLanguage } },
  });

  return [sentence, record.id] as const;
}

/**
 * Persists reusable sentence audio and romanization before structural writes so
 * the atomic transaction has a constant number of database round trips.
 */
export async function saveGeneratedSentenceMetadata({
  organizationId,
  sentenceAudioUrls,
  sentenceRomanizations,
  sentences,
  targetLanguage,
}: {
  organizationId: string;
  sentenceAudioUrls: Record<string, string>;
  sentenceRomanizations: Record<string, string>;
  sentences: ReadingSentence[];
  targetLanguage: string;
}): Promise<Record<string, string>> {
  const savedSentences = await Promise.all(
    sentences.map((readingSentence) =>
      saveReusableSentence({
        organizationId,
        readingSentence,
        sentenceAudioUrls,
        sentenceRomanizations,
        targetLanguage,
      }),
    ),
  );

  return Object.fromEntries(savedSentences);
}
