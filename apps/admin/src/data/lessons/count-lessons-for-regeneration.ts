import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { getLessonRegenerationWhere } from "@zoonk/core/library/lessons/regeneration-filter";
import { prisma } from "@zoonk/db";

const cachedCountLessonsForRegeneration = cacheAdminData((model?: string, promptVersion?: string) =>
  prisma.lesson.count({ where: getLessonRegenerationWhere({ model, promptVersion }) }),
);

/**
 * How many published lessons a regeneration with these filters would rewrite. It uses core's
 * match rule, so the number admins see is the set the API pulls.
 */
export async function countLessonsForRegeneration({
  model,
  promptVersion,
}: {
  model?: string;
  promptVersion?: string;
}) {
  return cachedCountLessonsForRegeneration(model, promptVersion);
}
