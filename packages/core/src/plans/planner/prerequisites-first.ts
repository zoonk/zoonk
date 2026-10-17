import { type PlannedItem } from "./plan-items";
import { type PlannerLesson } from "./plan-units";

type TaughtLessons = readonly Pick<PlannerLesson, "lessonId" | "skillIds">[];

/**
 * The skills the learner began, as R16 reads them: one with a lesson of its own past todo, or one
 * a lesson they finished teaches while counting for another skill (a language unit's rent lesson
 * also taught asking the rent).
 */
function getBegunSkills({
  items,
  lessons,
}: {
  items: readonly PlannedItem[];
  lessons: TaughtLessons;
}): Set<string> {
  const taughtBy = new Map(lessons.map((lesson) => [lesson.lessonId, lesson.skillIds]));

  return new Set(
    items.flatMap((item) => {
      if (item.kind !== "lesson") {
        return [];
      }

      const own = item.status !== "todo" && item.skillId ? [item.skillId] : [];
      const taught = item.status === "done" && item.lessonId ? taughtBy.get(item.lessonId) : [];
      return [...own, ...(taught ?? [])];
    }),
  );
}

/** Each skill's first lesson due, for the skills the learner hasn't begun. */
function getFirstLessons({
  items,
  lessons,
}: {
  items: readonly PlannedItem[];
  lessons: TaughtLessons;
}): Map<string, number> {
  const begun = getBegunSkills({ items, lessons });
  const planned = items.filter((item) => item.kind === "lesson" && item.skillId);

  return planned.reduce((firsts, item) => {
    const time = item.scheduledFor?.getTime();

    if (item.status !== "todo" || !item.skillId || begun.has(item.skillId) || time === undefined) {
      return firsts;
    }

    return firsts.set(item.skillId, Math.min(firsts.get(item.skillId) ?? time, time));
  }, new Map<string, number>());
}

/** The prerequisite pairs whose first lesson comes after its dependent's first. */
function listLatePrerequisites({
  items,
  lessons,
  prerequisites,
}: {
  items: readonly PlannedItem[];
  lessons: TaughtLessons;
  prerequisites: ReadonlyMap<string, readonly string[]>;
}): Set<string> {
  const firsts = getFirstLessons({ items, lessons });

  return new Set(
    [...prerequisites].flatMap(([skillId, bases]) =>
      bases.flatMap((baseId) => {
        const own = firsts.get(skillId);
        const base = firsts.get(baseId);
        const late = own !== undefined && base !== undefined && base > own;
        return late ? [`${baseId}>${skillId}`] : [];
      }),
    ),
  );
}

/**
 * Whether a layout puts a skill's first lesson before the first lesson of a skill it builds on
 * where the plan before it didn't: what a skill builds on comes first (R16, the planner's own
 * rule), so a learner's move never holds the plan to less, or more, than the planner does.
 */
export function breaksPrerequisitesFirst({
  after,
  before,
  lessons,
  prerequisites,
}: {
  after: readonly PlannedItem[];
  before: readonly PlannedItem[];
  /** The skills each Library lesson teaches, for the finished ones (see `getBegunSkills`). */
  lessons: TaughtLessons;
  prerequisites: ReadonlyMap<string, readonly string[]>;
}): boolean {
  const kept = listLatePrerequisites({ items: before, lessons, prerequisites });
  const late = listLatePrerequisites({ items: after, lessons, prerequisites });
  return [...late].some((pair) => !kept.has(pair));
}
