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

  const [skills, lessonSkills, tags] = await Promise.all([
    tx.skill.findMany({
      where: { OR: [{ id: { in: [...skillIds] } }, { mergedIntoId: { in: [...skillIds] } }] },
    }),
    tx.lessonSkill.findMany({ where: { lessonId: { in: allLessonIds } } }),
    tx.chapterSkill.findMany({
      where: {
        chapter: {
          OR: [
            { id: { in: [...chapterIds] } },
            { lessons: { some: { lessonId: { in: allLessonIds } } } },
          ],
        },
      },
    }),
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
  const { blueprintIds = [], chapterIds = [], courseIds = [], lessonIds = [], skillIds = [] } =
    roots;

  if ([blueprintIds, chapterIds, courseIds, lessonIds, skillIds].every((ids) => ids.length === 0)) {
    return [];
  }

  const sources = await loadPlanInputSources(tx, roots);
  const dependentSkills = sources.skillIds;
  const taggedSkill = { skillId: { in: dependentSkills } };
  const taughtLesson = { skills: { some: taggedSkill } };

  const taughtChapter = {
    OR: [{ goalSkills: { some: taggedSkill } }, { lessons: { some: { lesson: taughtLesson } } }],
  };

  const plans = await tx.plan.findMany({
    orderBy: { id: "asc" },
    select: { id: true },
    where: {
      OR: [
        { sourceSkillIds: { hasSome: dependentSkills } },
        { goal: { examBlueprintId: { in: [...blueprintIds] } } },
        { goal: { primaryCourseId: { in: [...courseIds] } } },
        { items: { some: { lessonId: { in: sources.lessonIds } } } },
        {
          // Legacy plans have not saved their pre-cut dependencies yet; retain their source links.
          OR: [
            ...dependentSkills.map((skillId) => ({
              graph: { array_contains: [{ skillId }], path: ["skills"] },
            })),
            {
              items: {
                some: { OR: [taggedSkill, { lesson: taughtLesson }, { chapter: taughtChapter }] },
              },
            },
            { goal: { primaryCourse: { courseChapters: { some: { chapter: taughtChapter } } } } },
          ],
          sourceSkillIds: { isEmpty: true },
        },
      ],
    },
  });

  return plans.map(({ id }) => id);
}
