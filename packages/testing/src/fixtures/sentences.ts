import { prisma } from "@zoonk/db";

export async function sentenceFixture(attrs: {
  organizationId: number;
  sentence?: string;
  targetLanguage?: string;
  alternativeSentences?: string[];
  romanization?: string | null;
  audioUrl?: string | null;
}) {
  return prisma.sentence.create({
    data: {
      alternativeSentences: attrs.alternativeSentences ?? [],
      audioUrl: attrs.audioUrl ?? null,
      organizationId: attrs.organizationId,
      romanization: attrs.romanization ?? null,
      sentence: attrs.sentence ?? `sentence-${crypto.randomUUID()}`,
      targetLanguage: attrs.targetLanguage ?? "es",
    },
  });
}

export async function sentenceTranslationFixture(attrs: {
  sentenceId: bigint;
  userLanguage?: string;
  translation?: string;
  alternativeTranslations?: string[];
  explanation?: string | null;
}) {
  return prisma.sentenceTranslation.create({
    data: {
      alternativeTranslations: attrs.alternativeTranslations ?? [],
      explanation: attrs.explanation ?? null,
      sentenceId: attrs.sentenceId,
      translation: attrs.translation ?? `translation-${crypto.randomUUID()}`,
      userLanguage: attrs.userLanguage ?? "en",
    },
  });
}
