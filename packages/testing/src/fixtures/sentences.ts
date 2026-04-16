import { prisma } from "@zoonk/db";

export async function sentenceFixture(attrs: {
  organizationId: string;
  sentence?: string;
  targetLanguage?: string;
  romanization?: string | null;
  audioUrl?: string | null;
}) {
  return prisma.sentence.create({
    data: {
      audioUrl: attrs.audioUrl ?? null,
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
  distractors?: string[];
  translationDistractors?: string[];
  explanation?: string | null;
}) {
  return prisma.lessonSentence.create({
    data: {
      distractors: attrs.distractors ?? [],
      explanation: attrs.explanation ?? null,
      lessonId: attrs.lessonId,
      sentenceId: attrs.sentenceId,
      translation: attrs.translation ?? `translation-${crypto.randomUUID()}`,
      translationDistractors: attrs.translationDistractors ?? [],
      userLanguage: attrs.userLanguage ?? "en",
    },
  });
}
