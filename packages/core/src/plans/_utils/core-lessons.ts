import { getCoreLessons } from "../planner/core-first";
import { type ExistingPlanItem } from "../planner/plan-items";
import { countItemLessons } from "./stand-in-lessons";

type CoreItem = Pick<ExistingPlanItem, "chapterId" | "kind" | "lessonId" | "lessons" | "skillId">;

/** The first of a skill's lesson items that hold `core` lessons, a stand-in as the ones it plans. */
function takeCore<TItem extends CoreItem>({
  core,
  lessons,
}: {
  core: number;
  lessons: readonly TItem[];
}): TItem[] {
  // The lessons before each item, its own not counted.
  const before = lessons.reduce<number[]>((sums, item, index) => {
    const previous = lessons[index - 1];
    sums.push(previous ? (sums[index - 1] ?? 0) + countItemLessons(previous) : 0);
    return sums;
  }, []);

  return lessons.filter((_, index) => (before[index] ?? 0) < core);
}

/**
 * Each skill's core lesson items in a plan (`items` in plan order): its first lessons, until they
 * hold the first third (`getCoreLessons`) of the lessons the plan's last build counted for it
 * (`plannedLessons`; the graph's estimate before a build counted them), a stand-in
 * counted as the lessons it plans. A phase's challenge waits for them (`getBossSkillIds`), and the
 * plan's checks read them the same way.
 */
export function listCoreLessonItems<TItem extends CoreItem>({
  graphSkills,
  items,
}: {
  graphSkills: readonly { lessons: number; plannedLessons?: number; skillId: string }[];
  items: readonly TItem[];
}): Map<string, TItem[]> {
  const sizes = new Map(
    graphSkills.map((skill) => [skill.skillId, skill.plannedLessons ?? skill.lessons]),
  );

  const lessons = items.filter((item) => item.kind === "lesson" && item.skillId);

  return new Map(
    [...Map.groupBy(lessons, (item) => item.skillId ?? "")].map(([skillId, own]) => {
      const total =
        sizes.get(skillId) ?? own.reduce((sum, item) => sum + countItemLessons(item), 0);

      return [skillId, takeCore({ core: getCoreLessons(total), lessons: own })];
    }),
  );
}
