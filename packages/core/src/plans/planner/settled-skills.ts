import { type ExistingPlanItem } from "./plan-items";
import { type PlannerLesson } from "./plan-units";

function getTestedOutSkillIds({
  skillId,
  taught,
}: {
  skillId: string;
  taught: readonly string[] | undefined;
}): readonly string[] {
  return !taught || taught.includes(skillId) ? [skillId] : taught;
}

export function getSettledSkillIds({
  items,
  lessons,
  missedSkillIds = new Set(),
}: {
  items: readonly Pick<ExistingPlanItem, "kind" | "lessonId" | "skillId" | "status">[];
  lessons: readonly Pick<PlannerLesson, "lessonId" | "skillIds">[];
  missedSkillIds?: ReadonlySet<string>;
}): Set<string> {
  const taughtBy = new Map(lessons.map((lesson) => [lesson.lessonId, lesson.skillIds]));

  return new Set(
    items.flatMap((item) => {
      if (item.kind !== "lesson" || !item.skillId || missedSkillIds.has(item.skillId)) {
        return [];
      }

      if (!item.lessonId) {
        return item.status === "todo" || item.status === "skipped" ? [] : [item.skillId];
      }

      return item.status === "testedOut"
        ? getTestedOutSkillIds({ skillId: item.skillId, taught: taughtBy.get(item.lessonId) })
        : [];
    }),
  );
}
