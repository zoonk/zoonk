import { LEARN_KINDS } from "../planner/plan-item-rules";
import { type ExistingPlanItem } from "../planner/plan-items";
import { withinLessonScope } from "./plan-end";
import { countLessonProgress } from "./work-progress";

type ProgressItem = Pick<
  ExistingPlanItem,
  "id" | "kind" | "chapterId" | "lessonId" | "lessons" | "skillId" | "status" | "phase"
>;

export function getPlanItemArea<Item extends Pick<ProgressItem, "skillId" | "chapterId">>({
  items,
  skillAreas,
}: {
  items: readonly Item[];
  skillAreas: ReadonlyMap<string, string | null>;
}): (item: Item) => string | null {
  const areaOf = (item: Item) => (item.skillId ? skillAreas.get(item.skillId) : undefined);

  const chapterAreas = new Map(
    items
      .flatMap((item) => {
        const area = areaOf(item);
        return item.chapterId && area ? [[item.chapterId, area] as const] : [];
      })
      .toReversed(),
  );

  return function itemArea(item) {
    return areaOf(item) ?? (item.chapterId ? chapterAreas.get(item.chapterId) : undefined) ?? null;
  };
}

/** One item counts once in a kept plan area, including chapter work and known lessons. */
export function countPlannedLessonProgress({
  items,
  skillAreas,
  skippedAreas = [],
  deadline,
  phase,
}: {
  items: readonly ProgressItem[];
  skillAreas: ReadonlyMap<string, string | null>;
  skippedAreas?: readonly string[];
  deadline: boolean;
  phase?: number;
}) {
  const scoped = withinLessonScope({ deadline, items });
  const areaOf = getPlanItemArea({ items: scoped, skillAreas });

  const planned = new Set(
    [...skillAreas.values()].filter((area) => area && !skippedAreas.includes(area)),
  );

  const kept = scoped.filter(
    (item) =>
      LEARN_KINDS.has(item.kind) &&
      (phase === undefined || item.phase === phase) &&
      planned.has(areaOf(item)),
  );

  return countLessonProgress([...new Map(kept.map((item) => [item.id, item])).values()]);
}
