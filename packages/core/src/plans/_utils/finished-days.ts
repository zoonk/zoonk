import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { LEARN_KINDS } from "../planner/plan-item-rules";
import { type ExistingPlanItem } from "../planner/plan-items";

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
