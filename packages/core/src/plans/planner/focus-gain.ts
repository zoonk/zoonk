import { toIsoDate } from "./plan-calendar";
import { type AreaEnd, type AreaStart } from "./plan-effect";
import { type PlannedItem } from "./plan-items";

type FocusItem = Pick<PlannedItem, "kind" | "minutes" | "scheduledFor" | "skillId" | "status">;

/** A plan item with its day, as saved or as a planning run lays it. */
type DatedItem = Omit<FocusItem, "minutes">;

/** Planned lesson minutes past this many are a lesson's worth: less is rounding, not depth. */
const MIN_MINUTES_GAINED = 1;

/** An area's lessons still to do in a plan. */
function listAreaLessons<TItem extends DatedItem>({
  areaOf,
  area,
  items,
}: {
  area: string;
  areaOf: (skillId: string) => string | null;
  items: readonly TItem[];
}): TItem[] {
  return items.filter(
    (item) =>
      item.kind === "lesson" &&
      item.status === "todo" &&
      item.skillId !== null &&
      areaOf(item.skillId) === area,
  );
}

/** When the first of these lessons is due; null when none has a day. */
function findFirstDue(items: readonly DatedItem[]): number | null {
  return items.reduce<number | null>((earliest, item) => {
    const time = item.scheduledFor?.getTime() ?? null;
    return time === null ? earliest : Math.min(earliest ?? time, time);
  }, null);
}

/** When the last of these lessons is due; null when none has a day. */
function findLastDue(items: readonly DatedItem[]): number | null {
  return items.reduce<number | null>((latest, item) => {
    const time = item.scheduledFor?.getTime() ?? null;
    return time === null ? latest : Math.max(latest ?? time, time);
  }, null);
}

/**
 * An area's lessons still to do in a plan: when the first and the last are due and the minutes
 * they take.
 */
function readArea(input: {
  area: string;
  areaOf: (skillId: string) => string | null;
  items: readonly FocusItem[];
}) {
  const own = listAreaLessons(input);

  return {
    first: findFirstDue(own),
    last: findLastDue(own),
    minutes: own.reduce((total, item) => total + item.minutes, 0),
  };
}

/**
 * Whether focusing these areas does what a learner asks it for: one of them starts earlier, gets
 * more of its lessons in a plan short on time, or, with every lesson in, is done sooner (Sofia's
 * "more Civil Law" ended it two months earlier). An area that already comes as early as what
 * it builds on allows and ends as soon as it can only shuffles the days around it, which isn't
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
    const endsEarlier = now.last !== null && was.last !== null && now.last < was.last;

    return startsEarlier || endsEarlier || now.minutes - was.minutes >= MIN_MINUTES_GAINED;
  });
}

/**
 * Whether less of these areas does what a learner asks it for: one of them loses lessons in a plan
 * short on time, or, with every lesson in, is done later. Less of an area that keeps every lesson
 * and ends when it did only shuffles the days around it, which isn't worth offering as a change.
 */
export function hasReduceEffect({
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
    const endsLater = now.last !== null && was.last !== null && now.last > was.last;

    return endsLater || was.minutes - now.minutes >= MIN_MINUTES_GAINED;
  });
}

function toDay(time: number | null): string | null {
  return time === null ? null : toIsoDate(new Date(time));
}

/**
 * When each focused area's first lesson still to do is due: in the plan the learner sees now
 * (`before`, as saved) and with the change. "Instead of" names the day their plan shows: Lucas was
 * told he "still" started biology on Oct 8, the day planning his plan again from today put it,
 * while his plan showed Oct 10.
 */
export function getAreaStarts({
  after,
  areaOf,
  areas,
  before,
}: {
  after: readonly DatedItem[];
  areaOf: (skillId: string) => string | null;
  areas: readonly string[];
  before: readonly DatedItem[];
}): AreaStart[] {
  return areas.map((area) => ({
    after: toDay(findFirstDue(listAreaLessons({ area, areaOf, items: after }))),
    area,
    before: toDay(findFirstDue(listAreaLessons({ area, areaOf, items: before }))),
  }));
}

/**
 * When each of these areas' last lesson still to do is due, in the plan the learner sees now
 * (`before`) and with the change, for the areas whose end moves: with every lesson in, more of an
 * area brings its end forward and less of one pushes it back, and the card says so.
 */
export function getAreaEnds({
  after,
  areaOf,
  areas,
  before,
}: {
  after: readonly DatedItem[];
  areaOf: (skillId: string) => string | null;
  areas: readonly string[];
  before: readonly DatedItem[];
}): AreaEnd[] {
  return areas.flatMap((area) => {
    const now = toDay(findLastDue(listAreaLessons({ area, areaOf, items: after })));
    const was = toDay(findLastDue(listAreaLessons({ area, areaOf, items: before })));

    return now && was && now !== was ? [{ after: now, area, before: was }] : [];
  });
}

/** A dated item with the lesson it teaches; null for a stand-in. */
type LessonItem = DatedItem & { lessonId: string | null };

/** A lesson item as a learner's plan holds it: the lesson, or the skill a stand-in stands for. */
function getLessonKey(item: LessonItem): string {
  return item.lessonId ?? `skill:${item.skillId ?? ""}`;
}

/**
 * When each area a change gives less time to has its last lesson still to do, before and after
 * it (see `getAreaEnds`), and for one that keeps every lesson and ends when it did, since
 * everything still fits by the date, that same day on both sides: the card says it keeps all of
 * it, so "less natural sciences" never reads as doing something it didn't, while the plan keeps the
 * learner's wish for when time gets short.
 */
export function getReducedEnds({
  after,
  areaOf,
  areas,
  before,
}: {
  after: readonly LessonItem[];
  areaOf: (skillId: string) => string | null;
  areas: readonly string[];
  before: readonly LessonItem[];
}): AreaEnd[] {
  const moved = getAreaEnds({ after, areaOf, areas, before });

  const kept = areas.flatMap((area) => {
    const [was, now] = [before, after].map((items) => listAreaLessons({ area, areaOf, items }));
    const day = toDay(findLastDue(now ?? []));
    const keys = new Set((now ?? []).map((item) => getLessonKey(item)));
    const keepsAll = (was ?? []).every((item) => keys.has(getLessonKey(item)));

    return day && day === toDay(findLastDue(was ?? [])) && keepsAll
      ? [{ after: day, area, before: day }]
      : [];
  });

  return areas.flatMap((area) => [...moved, ...kept].filter((end) => end.area === area));
}
