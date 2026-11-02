import { getCoreLessons } from "../planner/core-first";
import { type ExistingPlanItem } from "../planner/plan-items";
import { countItemLessons } from "./stand-in-lessons";

type CoreItem = Pick<ExistingPlanItem, "chapterId" | "kind" | "lessonId" | "lessons" | "skillId">;

function takeCore<TItem extends CoreItem>({
  core,
  lessons,
}: {
  core: number;
  lessons: readonly TItem[];
}): TItem[] {
  const before = lessons.reduce<number[]>((sums, item, index) => {
    const previous = lessons[index - 1];
    sums.push(previous ? (sums[index - 1] ?? 0) + countItemLessons(previous) : 0);
    return sums;
  }, []);

  return lessons.filter((_, index) => (before[index] ?? 0) < core);
}

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
