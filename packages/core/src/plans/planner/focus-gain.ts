import { toIsoDate } from "./plan-calendar";
import { type AreaStart } from "./plan-effect";
import { type PlannedItem } from "./plan-items";

type FocusItem = Pick<PlannedItem, "kind" | "minutes" | "scheduledFor" | "skillId" | "status">;

/** Planned lesson minutes past this many are a lesson's worth: less is rounding, not depth. */
const MIN_MINUTES_GAINED = 1;

/** An area's lessons still to do in a plan: when the first is due and the minutes they take. */
function readArea({
  areaOf,
  area,
  items,
}: {
  area: string;
  areaOf: (skillId: string) => string | null;
  items: readonly FocusItem[];
}) {
  const own = items.filter(
    (item) =>
      item.kind === "lesson" &&
      item.status === "todo" &&
      item.skillId !== null &&
      areaOf(item.skillId) === area,
  );

  const first = own.reduce<number | null>((earliest, item) => {
    const time = item.scheduledFor?.getTime() ?? null;
    return time === null ? earliest : Math.min(earliest ?? time, time);
  }, null);

  return { first, minutes: own.reduce((total, item) => total + item.minutes, 0) };
}

/**
 * Whether focusing these areas does what a learner asks it for: one of them starts earlier, or
 * gets more of its lessons in a plan short on time. An area that already comes as early as what
 * it builds on allows, with all its lessons in, only shuffles the days around it, which isn't
 * worth offering as a change.
 */
export function hasFocusGain({
  after,
  areaOf,
  areas,
  before,
}: {
  after: readonly FocusItem[];
  areaOf: (skillId: string) => string | null;
  areas: readonly string[];
  before: readonly FocusItem[];
}): boolean {
  return areas.some((area) => {
    const was = readArea({ area, areaOf, items: before });
    const now = readArea({ area, areaOf, items: after });
    const startsEarlier = now.first !== null && (was.first === null || now.first < was.first);

    return startsEarlier || now.minutes - was.minutes >= MIN_MINUTES_GAINED;
  });
}

function toDay(time: number | null): string | null {
  return time === null ? null : toIsoDate(new Date(time));
}

/** When each focused area's first lesson still to do is due, before and after a change. */
export function getAreaStarts({
  after,
  areaOf,
  areas,
  before,
}: {
  after: readonly FocusItem[];
  areaOf: (skillId: string) => string | null;
  areas: readonly string[];
  before: readonly FocusItem[];
}): AreaStart[] {
  return areas.map((area) => ({
    after: toDay(readArea({ area, areaOf, items: after }).first),
    area,
    before: toDay(readArea({ area, areaOf, items: before }).first),
  }));
}
