import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type PlanReadItem } from "./plan-read-projection";
import { projectSavedAllocationOn } from "./saved-allocation";
import { isWorkFinished } from "./work-progress";

export function projectItemOnDay({
  date,
  item,
  timeZone,
}: {
  date: Date;
  item: PlanReadItem;
  timeZone: string;
}): PlanReadItem | null {
  if (isWorkFinished(item.status) || item.lessonId) {
    const placed =
      isWorkFinished(item.status) && item.completedAt
        ? getDateInTimeZone({ date: item.completedAt, timeZone })
        : item.scheduledFor;

    return placed?.getTime() === date.getTime() ? { ...item, scheduledFor: date } : null;
  }

  return projectSavedAllocationOn({ date, item });
}
