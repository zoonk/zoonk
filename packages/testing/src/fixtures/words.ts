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

export async function wordTranslationFixture(attrs: {
  wordId: bigint;
  userLanguage?: string;
  translation?: string;
  alternativeTranslations?: string[];
  pronunciation?: string | null;
}) {
  return prisma.wordTranslation.create({
    data: {
      alternativeTranslations: attrs.alternativeTranslations ?? [],
      pronunciation: attrs.pronunciation ?? "test-pronunciation",
      translation: attrs.translation ?? `translation-${crypto.randomUUID()}`,
      userLanguage: attrs.userLanguage ?? "en",
      wordId: attrs.wordId,
    },
  });
}
