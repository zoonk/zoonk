import { prisma } from "@zoonk/db";
import { getFixtureChapterId } from "./_utils/get-fixture-chapter-id";

export async function wordFixture(attrs: {
  organizationId: string;
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
  wordId: string;
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

export async function chapterWordFixture(attrs: {
  chapterId?: string;
  sourceLessonId: string;
  wordId: string;
  userLanguage?: string;
  translation?: string;
  distractors?: string[];
}) {
  const chapterId = await getFixtureChapterId({
    chapterId: attrs.chapterId,
    sourceLessonId: attrs.sourceLessonId,
  });

  return prisma.chapterWord.create({
    data: {
      chapterId,
      distractors: attrs.distractors ?? [],
      sourceLessonId: attrs.sourceLessonId,
      translation: attrs.translation ?? `translation-${crypto.randomUUID()}`,
      userLanguage: attrs.userLanguage ?? "en",
      wordId: attrs.wordId,
    },
  });
}
