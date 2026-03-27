import { prisma } from "@zoonk/db";

export async function wordFixture(attrs: {
  organizationId: number;
  word?: string;
  targetLanguage?: string;
  romanization?: string | null;
  audioUrl?: string | null;
}) {
  return prisma.word.create({
    data: {
      audioUrl: attrs.audioUrl ?? null,
      organizationId: attrs.organizationId,
      romanization: attrs.romanization ?? null,
      targetLanguage: attrs.targetLanguage ?? "es",
      word: attrs.word ?? `word-${crypto.randomUUID()}`,
    },
  });
}

export async function wordPronunciationFixture(attrs: {
  wordId: bigint;
  userLanguage?: string;
  pronunciation?: string;
}) {
  return prisma.wordPronunciation.create({
    data: {
      pronunciation: attrs.pronunciation ?? "test-pronunciation",
      userLanguage: attrs.userLanguage ?? "en",
      wordId: attrs.wordId,
    },
  });
}

export async function lessonWordFixture(attrs: {
  lessonId: number;
  wordId: bigint;
  userLanguage?: string;
  translation?: string;
  distractorUnsafeTranslations?: string[];
}) {
  return prisma.lessonWord.create({
    data: {
      distractorUnsafeTranslations: attrs.distractorUnsafeTranslations ?? [],
      lessonId: attrs.lessonId,
      translation: attrs.translation ?? `translation-${crypto.randomUUID()}`,
      userLanguage: attrs.userLanguage ?? "en",
      wordId: attrs.wordId,
    },
  });
}
