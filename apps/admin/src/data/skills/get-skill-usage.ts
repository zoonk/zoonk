import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { MasteryState, prisma } from "@zoonk/db";

/** Detail tables list the first rows; the section heading carries the full count. */
export const MAX_SKILL_USAGE_ROWS = 50;

const cachedGetSkillUsage = cacheAdminData(async (skillId: string) => {
  const [lessons, chapters, items] = await Promise.all([
    prisma.lessonSkill.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        lesson: {
          select: { contentStatus: true, id: true, level: true, title: true, visibility: true },
        },
      },
      take: MAX_SKILL_USAGE_ROWS,
      where: { skillId },
    }),
    prisma.chapterSkill.findMany({
      orderBy: { createdAt: "asc" },
      select: { chapter: { select: { id: true, level: true, title: true, visibility: true } } },
      take: MAX_SKILL_USAGE_ROWS,
      where: { skillId },
    }),
    prisma.item.findMany({
      orderBy: { createdAt: "asc" },
      select: { content: true, field: true, format: true, id: true, language: true },
      take: MAX_SKILL_USAGE_ROWS,
      where: { skillId },
    }),
  ]);

  return {
    chapters: chapters.map((row) => row.chapter),
    items,
    lessons: lessons.map((row) => row.lesson),
  };
});

/** Where a skill is taught and practiced: its lessons, chapters and items. */
export async function getSkillUsage(skillId: string) {
  return cachedGetSkillUsage(skillId);
}

const cachedCountSkillLearnersByState = cacheAdminData(async (skillId: string) => {
  const rows = await prisma.learnerSkill.groupBy({
    _count: { id: true },
    by: ["state"],
    where: { skillId, ...trackedAnalyticsUserRelationWhere },
  });

  return Object.values(MasteryState).map((state) => ({
    count: rows.find((row) => row.state === state)?._count.id ?? 0,
    state,
  }));
});

/**
 * How many learners sit in each mastery state for the skill. Counts only: the
 * learners themselves are personal data and live on their user pages.
 */
export async function countSkillLearnersByState(skillId: string) {
  return cachedCountSkillLearnersByState(skillId);
}
