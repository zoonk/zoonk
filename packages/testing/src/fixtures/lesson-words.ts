import { prisma } from "@zoonk/db";

/**
 * Creates a minimal LessonWord record. For tests that also need
 * translation data, use the richer `lessonWordFixture` exported
 * from `@zoonk/testing/fixtures/words` instead.
 */
export async function lessonWordFixture(attrs: {
  lessonId: number;
  wordId: bigint;
  userLanguage?: string;
  translation?: string;
}) {
  return prisma.lessonWord.create({
    data: {
      lessonId: attrs.lessonId,
      translation: attrs.translation ?? "",
      userLanguage: attrs.userLanguage ?? "en",
      wordId: attrs.wordId,
    },
  });
}
