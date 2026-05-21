import { prisma } from "@zoonk/db";

/**
 * Chapter-scoped fixtures often receive only the source lesson because the test
 * is focused on the word or sentence resource. This helper keeps that default
 * lookup in one place so word and sentence fixtures do not duplicate it.
 */
export async function getFixtureChapterId({
  chapterId,
  sourceLessonId,
}: {
  chapterId: string | undefined;
  sourceLessonId: string;
}): Promise<string> {
  if (chapterId) {
    return chapterId;
  }

  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: sourceLessonId } });
  return lesson.chapterId;
}
