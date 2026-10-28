import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type ExistingPlanItem } from "../planner/plan-items";

const LEARN_KINDS: ReadonlySet<ExistingPlanItem["kind"]> = new Set(["chapter", "lesson"]);

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
