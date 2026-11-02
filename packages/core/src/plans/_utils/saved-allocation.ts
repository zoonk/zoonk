import { toIsoDate } from "../planner/plan-calendar";
import { type PlanReadItem } from "./plan-read-projection";
import { readSelectedItemFacts } from "./selected-item-contract";

export function projectSavedAllocationOn({
  date,
  item,
}: {
  date: Date;
  item: PlanReadItem;
}): PlanReadItem | null {
  const day = toIsoDate(date);
  const facts = readSelectedItemFacts(item.facts);

  if (facts?.days) {
    const portion = facts.days.find(([allocated]) => allocated === day);
    return portion && portion[1] > 0 ? { ...item, minutes: portion[1], scheduledFor: date } : null;
  }

  return item.scheduledFor && toIsoDate(item.scheduledFor) === day ? item : null;
}
