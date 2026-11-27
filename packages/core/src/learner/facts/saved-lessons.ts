import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getSavedLessonsCacheTag } from "../../cache/tags";

export async function readSavedLessonIds(userId: string) {
  "use cache: private";

  cacheTag(getSavedLessonsCacheTag(userId));

  const rows = await prisma.savedLesson.findMany({ select: { lessonId: true }, where: { userId } });
  return new Set(rows.map((row) => row.lessonId));
}
