import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const countLibraryContent = cacheAdminData(async () => {
  const [
    courses,
    chapters,
    lessons,
    lessonOutlines,
    steps,
    skills,
    items,
    images,
    audio,
    sources,
    examBlueprints,
  ] = await Promise.all([
    prisma.course.count({ where: { courseChapters: { some: {} } } }),
    prisma.chapter.count({ where: { outlineStatus: "completed" } }),
    prisma.lesson.count({ where: { contentStatus: "completed" } }),
    prisma.lesson.count(),
    prisma.step.count({ where: { retiredAt: null } }),
    prisma.skill.count({ where: { mergedIntoId: null } }),
    prisma.item.count(),
    prisma.mediaAsset.count({ where: { kind: "image" } }),
    prisma.mediaAsset.count({ where: { kind: "audio" } }),
    prisma.source.count(),
    prisma.examBlueprint.count(),
  ]);

  return {
    audio,
    chapters,
    courses,
    examBlueprints,
    images,
    items,
    lessonOutlines,
    lessons,
    skills,
    sources,
    steps,
  };
});
