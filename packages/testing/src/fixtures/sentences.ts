import { prisma } from "@zoonk/db";

export async function sentenceFixture(attrs: {
  organizationId: number;
  sentence?: string;
  targetLanguage?: string;
  distractorUnsafeSentences?: string[];
  romanization?: string | null;
  audioUrl?: string | null;
}) {
  return prisma.sentence.create({
    data: {
      audioUrl: attrs.audioUrl ?? null,
      distractorUnsafeSentences: attrs.distractorUnsafeSentences ?? [],
      organizationId: attrs.organizationId,
      romanization: attrs.romanization ?? null,
      sentence: attrs.sentence ?? `sentence-${crypto.randomUUID()}`,
      targetLanguage: attrs.targetLanguage ?? "es",
    },
  });
}

export async function lessonSentenceFixture(attrs: {
  lessonId: number;
  sentenceId: bigint;
  userLanguage?: string;
  translation?: string;
  distractorUnsafeTranslations?: string[];
  explanation?: string | null;
}) {
  return prisma.lessonSentence.create({
    data: {
      distractorUnsafeTranslations: attrs.distractorUnsafeTranslations ?? [],
      explanation: attrs.explanation ?? null,
      lessonId: attrs.lessonId,
      sentenceId: attrs.sentenceId,
      translation: attrs.translation ?? `translation-${crypto.randomUUID()}`,
      userLanguage: attrs.userLanguage ?? "en",
    },
  });
}
