import "server-only";
import { prisma } from "@zoonk/db";

/**
 * Library rows a learner's GET reads need, the same for everyone who reads the same ids, so they're
 * cached once for all of them ("use cache"). Each leaf is keyed by the ids of the rows themselves
 * (lessons, skills, chapters, courses), never by a parent whose children another app adds: a plan
 * that gains a lesson asks for a new key and reads it fresh. What can change under an existing id
 * (a skill merge, a renamed chapter) shows within the default revalidation, as the catalog does;
 * writes read these rows fresh. Callers pass ids through `toIdKey`, so equal sets share one entry.
 */

/** Ids deduped and sorted, so equal sets share one cache key. */
export function toIdKey(ids: Iterable<string | null | undefined>): string[] {
  return [...new Set([...ids].filter((id): id is string => Boolean(id)))].toSorted();
}

/** The skills each of these lessons teaches, oldest link first. */
export async function getLessonSkillRows(lessonIds: string[]) {
  "use cache";

  if (lessonIds.length === 0) {
    return [];
  }

  return prisma.lessonSkill.findMany({
    orderBy: [{ createdAt: "asc" }, { skillId: "asc" }],
    select: { lessonId: true, skillId: true },
    where: { lessonId: { in: lessonIds } },
  });
}

/** Each of these lessons' home chapter, where the skill projection files a lesson without one. */
export async function getLessonHomeChapterRows(lessonIds: string[]) {
  "use cache";

  if (lessonIds.length === 0) {
    return [];
  }

  return prisma.lesson.findMany({
    select: { homeChapterId: true, id: true },
    where: { id: { in: lessonIds } },
  });
}

export type LessonSkillRow = Awaited<ReturnType<typeof getLessonSkillRows>>[number];

/** The merged skills among these, each with its survivor. */
export async function getMergedSkillRows(skillIds: string[]) {
  "use cache";

  if (skillIds.length === 0) {
    return [];
  }

  return prisma.skill.findMany({
    select: { id: true, mergedIntoId: true },
    where: { id: { in: skillIds }, mergedIntoId: { not: null } },
  });
}

/** The prerequisite edges between these skills. */
export async function getSkillPrerequisiteRows(skillIds: string[]) {
  "use cache";

  if (skillIds.length === 0) {
    return [];
  }

  return prisma.skillPrerequisite.findMany({
    select: { prerequisiteId: true, skillId: true },
    where: { prerequisiteId: { in: skillIds }, skillId: { in: skillIds } },
  });
}

/** Each of these skills' level band. */
export async function getSkillLevelRows(skillIds: string[]) {
  "use cache";

  if (skillIds.length === 0) {
    return [];
  }

  return prisma.skill.findMany({
    select: { id: true, level: true },
    where: { id: { in: skillIds } },
  });
}

/** These chapters' titles. */
export async function getChapterTitleRows(chapterIds: string[]) {
  "use cache";

  if (chapterIds.length === 0) {
    return [];
  }

  return prisma.chapter.findMany({
    select: { id: true, title: true },
    where: { id: { in: chapterIds } },
  });
}

/** These courses' titles and pictures. */
export async function getCourseCardRows(courseIds: string[]) {
  "use cache";

  if (courseIds.length === 0) {
    return [];
  }

  return prisma.course.findMany({
    select: { id: true, imageUrl: true, title: true },
    where: { id: { in: courseIds } },
  });
}
