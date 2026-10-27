import "server-only";
import { type TransactionClient } from "@zoonk/db";

/** What a content write changes, as plans read it: lessons, chapters, skills, blueprints, courses. */
export type PlanInputRoots = {
  blueprintIds?: readonly string[];
  chapterIds?: readonly string[];
  courseIds?: readonly string[];
  lessonIds?: readonly string[];
  skillIds?: readonly string[];
};

/**
 * The lessons and skills a write reaches plans through: the given lessons and the lessons of the
 * given chapters, then the given skills, the skills merged into them, the skills those lessons
 * teach, and the tags of the chapters holding them or given. A plan may have registered only a
 * lesson's chapter tag, so the tags count as much as the skills the lesson teaches.
 */
export async function loadPlanInputSources(
  tx: TransactionClient,
  { chapterIds = [], lessonIds = [], skillIds = [] }: PlanInputRoots,
): Promise<{ lessonIds: string[]; skillIds: string[] }> {
  const placed =
    chapterIds.length > 0
      ? await tx.chapterLesson.findMany({ where: { chapterId: { in: [...chapterIds] } } })
      : [];

  const allLessonIds = [...new Set([...lessonIds, ...placed.map(({ lessonId }) => lessonId)])];
  // A write of skills alone (a merge, which holds its locks meanwhile) skips reads that find nothing.
  const hasLessons = allLessonIds.length > 0;

  const [skills, lessonSkills, tags] = await Promise.all([
    tx.skill.findMany({
      where: { OR: [{ id: { in: [...skillIds] } }, { mergedIntoId: { in: [...skillIds] } }] },
    }),
    hasLessons
      ? tx.lessonSkill.findMany({ where: { lessonId: { in: allLessonIds } } })
      : Promise.resolve([]),
    hasLessons || chapterIds.length > 0
      ? tx.chapterSkill.findMany({
          where: {
            chapter: {
              OR: [
                { id: { in: [...chapterIds] } },
                { lessons: { some: { lessonId: { in: allLessonIds } } } },
              ],
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const allSkillIds = [
    ...new Set([
      ...skillIds,
      ...skills.flatMap(({ id, mergedIntoId }) => [id, ...(mergedIntoId ? [mergedIntoId] : [])]),
      ...lessonSkills.map(({ skillId }) => skillId),
      ...tags.map(({ skillId }) => skillId),
    ]),
  ];

  return { lessonIds: allLessonIds, skillIds: allSkillIds };
}

/** Resolve references before a content writer deletes or reassigns them, inside its transaction. */
export async function resolvePlanInputDependents(
  tx: TransactionClient,
  roots: PlanInputRoots,
): Promise<string[]> {
  const {
    blueprintIds = [],
    chapterIds = [],
    courseIds = [],
    lessonIds = [],
    skillIds = [],
  } = roots;

  if ([blueprintIds, chapterIds, courseIds, lessonIds, skillIds].every((ids) => ids.length === 0)) {
    return [];
  }

  const sources = await loadPlanInputSources(tx, roots);

  const plans = await tx.plan.findMany({
    orderBy: { id: "asc" },
    select: { id: true },
    where: {
      OR: [
        { sourceSkillIds: { hasSome: sources.skillIds } },
        { goal: { examBlueprintId: { in: [...blueprintIds] } } },
        { goal: { primaryCourseId: { in: [...courseIds] } } },
        { items: { some: { lessonId: { in: sources.lessonIds } } } },
      ],
    },
  });

  return plans.map(({ id }) => id);
}
