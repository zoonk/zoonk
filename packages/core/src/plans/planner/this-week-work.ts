import { readSelectedItemFacts } from "../_utils/selected-item-contract";
import { type StudyPortion } from "./interval-study-minutes";
import { toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem, getItemKey } from "./plan-items";
import { type QueueUnit } from "./plan-units";

/**
 * `share` of the unit stays where it was saved, from `date`, on its saved `days` when it has them;
 * `later` is laid out after the kept days.
 */
export type KeptPiece = {
  date: Date;
  days?: StudyPortion[];
  key: string;
  later: number;
  share: number;
};

export function getKeptShare({
  item,
  units,
}: {
  item: ExistingPlanItem;
  units: ReadonlyMap<string, QueueUnit>;
}): number {
  const total = units.get(getItemKey(item))?.lessons;
  return item.lessonId === null && item.lessons && total ? Math.min(1, item.lessons / total) : 1;
}

/** An item saved this week can teach past it, as a stand-in split into lessons does. */
function listSavedDaysUntil({ end, item }: { end: Date | null; item: ExistingPlanItem }) {
  const days = readSelectedItemFacts(item.facts)?.days ?? [];
  const last = end && toIsoDate(end);
  const total = days.reduce((sum, day) => sum + day[2], 0);

  const until = days.flatMap(([date, minutes, lessonMinutes]) =>
    !last || date <= last ? [{ date, lessonMinutes, minutes }] : [],
  );

  const kept = until.reduce((sum, day) => sum + day.lessonMinutes, 0);

  return total > 0 ? { days: until, share: kept / total } : { share: 1 };
}

export function listThisWeekWork({
  end,
  frozen,
  units,
}: {
  end: Date | null;
  frozen: readonly ExistingPlanItem[];
  units: ReadonlyMap<string, QueueUnit>;
}): KeptPiece[] {
  return frozen.flatMap((item) => {
    if (!item.scheduledFor) {
      return [];
    }

    const kept = getKeptShare({ item, units });
    const { days, share } = listSavedDaysUntil({ end, item });

    return [
      {
        date: item.scheduledFor,
        ...(days && { days }),
        key: getItemKey(item),
        later: kept * (1 - share),
        share: kept * share,
      },
    ];
  });
}

/** The lessons that landed in a stand-in's place carry their own days. */
export function withoutLandedDays<T>({
  days,
  landed,
}: {
  days: ReadonlyMap<string, T>;
  landed: readonly ExistingPlanItem[];
}): Map<string, T> {
  const keys = new Set(landed.map((item) => getItemKey(item)));
  return new Map([...days].filter(([key]) => !keys.has(key)));
}
