import { prisma } from "@zoonk/db";
import { getFixtureChapterId } from "./_utils/get-fixture-chapter-id";

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

export async function chapterSentenceFixture(attrs: {
  chapterId?: string;
  sourceLessonId: string;
  sentenceId: string;
  userLanguage?: string;
  translation?: string;
  distractors?: string[];
  translationDistractors?: string[];
  explanation?: string | null;
}) {
  const chapterId = await getFixtureChapterId({
    chapterId: attrs.chapterId,
    sourceLessonId: attrs.sourceLessonId,
  });

  return prisma.chapterSentence.create({
    data: {
      chapterId,
      distractors: attrs.distractors ?? [],
      explanation: attrs.explanation ?? null,
      sentenceId: attrs.sentenceId,
      sourceLessonId: attrs.sourceLessonId,
      translation: attrs.translation ?? `translation-${crypto.randomUUID()}`,
      translationDistractors: attrs.translationDistractors ?? [],
      userLanguage: attrs.userLanguage ?? "en",
    },
  });
}
