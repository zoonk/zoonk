import "server-only";
import { type TransactionClient } from "@zoonk/db";

/** Resolve references before a content writer deletes or reassigns them, inside its transaction. */
export async function resolvePlanInputDependents(
  tx: TransactionClient,
  {
    blueprintIds = [],
    courseIds = [],
    lessonIds = [],
    skillIds = [],
  }: {
    blueprintIds?: readonly string[];
    courseIds?: readonly string[];
    lessonIds?: readonly string[];
    skillIds?: readonly string[];
  },
): Promise<string[]> {
  if ([blueprintIds, courseIds, lessonIds, skillIds].every((ids) => ids.length === 0)) {
    return [];
  }

  const [skills, lessonSkills] = await Promise.all([
    tx.skill.findMany({
      where: { OR: [{ id: { in: [...skillIds] } }, { mergedIntoId: { in: [...skillIds] } }] },
    }),
    tx.lessonSkill.findMany({ where: { lessonId: { in: [...lessonIds] } } }),
  ]);

  const dependentSkills = [
    ...new Set([
      ...skillIds,
      ...skills.flatMap(({ id, mergedIntoId }) => [id, ...(mergedIntoId ? [mergedIntoId] : [])]),
      ...lessonSkills.map(({ skillId }) => skillId),
    ]),
  ];

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
        { items: { some: { lessonId: { in: [...lessonIds] } } } },
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
