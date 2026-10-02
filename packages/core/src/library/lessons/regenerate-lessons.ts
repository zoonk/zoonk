import "server-only";
import { prisma } from "@zoonk/db";
import { getAdminAccess } from "../../users/get-admin-access";
import { pullLessonForFix } from "../quality/later-reviews";
import {
  type LessonRegenerationFilter,
  MAX_LESSONS_PER_REGENERATION,
  getLessonRegenerationWhere,
} from "./regeneration-filter";

export type LessonRegenerationResult =
  | { lessonIds: string[]; status: "pulled" }
  | { status: "forbidden" | "invalid" | "unauthorized" };

/**
 * Takes the oldest published lessons written by a model or prompt version out of play so they
 * are written again (`pullLessonForFix`), up to `MAX_LESSONS_PER_REGENERATION` at a time. The
 * caller starts a writing run for each returned lesson. Learners keep their answers: attempts
 * point at steps with SetNull. Only admins may do this, and a filter is required so one click
 * never rewrites the whole Library.
 */
export async function pullLessonsForRegeneration(
  filter: LessonRegenerationFilter,
): Promise<LessonRegenerationResult> {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  if (!(filter.model || filter.promptVersion)) {
    return { status: "invalid" };
  }

  const lessons = await prisma.lesson.findMany({
    orderBy: { updatedAt: "asc" },
    select: { id: true },
    take: MAX_LESSONS_PER_REGENERATION,
    where: getLessonRegenerationWhere(filter),
  });

  const pulled = await Promise.all(
    lessons.map(async (lesson) => ((await pullLessonForFix(lesson.id)) ? [lesson.id] : [])),
  );

  return { lessonIds: pulled.flat(), status: "pulled" };
}
