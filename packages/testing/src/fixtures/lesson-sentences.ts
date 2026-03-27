import { prisma } from "@zoonk/db";

/**
 * Creates a minimal LessonSentence record. For tests that also need
 * translation data, use the richer `lessonSentenceFixture` exported
 * from `@zoonk/testing/fixtures/sentences` instead.
 */
export async function lessonSentenceFixture(attrs: {
  lessonId: number;
  sentenceId: bigint;
  userLanguage?: string;
  translation?: string;
}) {
  return prisma.lessonSentence.create({
    data: {
      lessonId: attrs.lessonId,
      sentenceId: attrs.sentenceId,
      translation: attrs.translation ?? "",
      userLanguage: attrs.userLanguage ?? "en",
    },
  });
}
