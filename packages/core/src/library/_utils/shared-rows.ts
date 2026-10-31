import "server-only";
import { prisma } from "@zoonk/db";

/** Use for shared-row cache arguments so equivalent id sets share a cache entry. */
export function toIdKey(ids: Iterable<string | null | undefined>): string[] {
  return [...new Set([...ids].filter((id): id is string => Boolean(id)))].toSorted();
}

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
