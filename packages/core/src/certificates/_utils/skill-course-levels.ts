import "server-only";
import { type CourseLevel, type Plan, type PlanItem, type TransactionClient } from "@zoonk/db";
import { CourseLevel as COURSE_LEVELS } from "@zoonk/db/enums";
import { type PlanScope } from "../../plans/_utils/half-studied";
import { isStandIn } from "../../plans/planner/plan-item-rules";
import { parsePlanGraph } from "../../plans/planner/plan-state";

const LEVEL_ORDER: readonly CourseLevel[] = Object.values(COURSE_LEVELS);

/**
 * The levels of the primary course whose chapters hold each skill's lessons, a lesson the plan
 * holds in the chapter its item counts in. A skill's own stored level comes from the course that
 * first made it, so another course can teach it at other levels.
 */
function placeSkills({
  chapterLevels,
  heldChapters,
  scope,
}: {
  chapterLevels: ReadonlyMap<string, CourseLevel>;
  heldChapters: ReadonlyMap<string, string | null>;
  scope: PlanScope;
}): Map<string, readonly CourseLevel[]> {
  const placements = scope.lessons.flatMap((lesson) => {
    const chapterId = heldChapters.get(lesson.lessonId) ?? lesson.chapterId;
    const level = chapterLevels.get(chapterId ?? "");
    return level ? lesson.skillIds.map((skillId) => ({ level, skillId })) : [];
  });

  return new Map(
    [...Map.groupBy(placements, (placement) => placement.skillId)].map(([skillId, placed]) => [
      skillId,
      LEVEL_ORDER.filter((level) => placed.some((placement) => placement.level === level)),
    ]),
  );
}

/**
 * The primary course's levels, lowest first, of each graph skill and stand-in skill the plan's
 * graph gives it: every level teaching its lessons, or its own level while none of the course's
 * lessons teaches it.
 */
export async function loadSkillCourseLevels(
  db: TransactionClient,
  {
    chapterLevels,
    goal,
    heldChapters,
    plan,
    scope,
  }: {
    chapterLevels: ReadonlyMap<string, CourseLevel>;
    goal: { primaryCourseId: string | null };
    heldChapters: ReadonlyMap<string, string | null>;
    plan: Pick<Plan, "graph"> & {
      items: readonly Pick<PlanItem, "chapterId" | "kind" | "lessonId" | "skillId">[];
    };
    scope: PlanScope;
  },
): Promise<Map<string, readonly CourseLevel[]>> {
  const courses = new Map([
    ...parsePlanGraph(plan.graph).skills.map(
      (skill) => [skill.skillId, skill.courseIds?.[0]] as const,
    ),
    ...scope.keptSkills.map((skill) => [skill.skillId, skill.courseIds?.[0]] as const),
  ]);

  const skillIds = [
    ...new Set([
      ...scope.keptSkills.map((skill) => skill.skillId),
      ...plan.items.flatMap((item) => (isStandIn(item) && item.skillId ? item.skillId : [])),
    ]),
  ].filter((skillId) => (courses.get(skillId) ?? goal.primaryCourseId) === goal.primaryCourseId);

  if (!goal.primaryCourseId || skillIds.length === 0) {
    return new Map();
  }

  const placed = placeSkills({ chapterLevels, heldChapters, scope });
  const unplaced = skillIds.filter((skillId) => !placed.has(skillId));

  const stored =
    unplaced.length > 0
      ? await db.skill.findMany({
          select: { id: true, level: true },
          where: { id: { in: unplaced } },
        })
      : [];

  return new Map<string, readonly CourseLevel[]>([
    ...skillIds.flatMap((skillId) => {
      const levels = placed.get(skillId);
      return levels ? [[skillId, levels] as const] : [];
    }),
    ...stored.flatMap((skill) => (skill.level ? [[skill.id, [skill.level]] as const] : [])),
  ]);
}
