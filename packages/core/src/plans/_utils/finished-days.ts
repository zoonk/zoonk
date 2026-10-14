import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type ExistingPlanItem } from "../planner/plan-items";

const LEARN_KINDS: ReadonlySet<ExistingPlanItem["kind"]> = new Set(["chapter", "lesson"]);

/**
 * The learner's own day each finished lesson of the plan was done, by item id: the day it was
 * taught, early or late, whatever day the plan had it on (see `BuildPlanInput.finishedOn`). A
 * lesson done before its time was saved has none.
 */
export function listFinishedDays({
  items,
  timeZone,
}: {
  items: readonly Pick<ExistingPlanItem, "completedAt" | "id" | "kind" | "status">[];
  timeZone: string;
}): Map<string, Date> {
  return new Map(
    items.flatMap((item) =>
      LEARN_KINDS.has(item.kind) && item.status === "done" && item.completedAt
        ? [[item.id, getDateInTimeZone({ date: item.completedAt, timeZone })] as const]
        : [],
    ),
  );
}
