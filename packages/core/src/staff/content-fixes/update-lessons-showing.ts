import "server-only";
import { prisma } from "@zoonk/db";
import { type VocabularyUnit, findLessonsShowing } from "./_utils/vocabulary-unit";

/**
 * Internal workflow bridge for the work an applied word or sentence fix owes: every lesson that
 * shows it moves its version, so each app and client holding one loads it again. Each lesson is
 * its own statement, so this never holds one lesson while it waits for another.
 */
export async function updateLessonsShowing(unit: VocabularyUnit): Promise<void> {
  const lessonIds = await findLessonsShowing(prisma, unit);
  const now = new Date();

  for (const id of lessonIds) {
    // oxlint-disable-next-line no-await-in-loop -- one statement per lesson
    await prisma.lesson.updateMany({ data: { updatedAt: now }, where: { id } });
  }
}
