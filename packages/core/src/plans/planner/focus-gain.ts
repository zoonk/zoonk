import { toIsoDate } from "./plan-calendar";
import { type AreaEnd, type AreaStart } from "./plan-effect";
import { type PlannedItem } from "./plan-items";

type FocusItem = Pick<PlannedItem, "kind" | "minutes" | "scheduledFor" | "skillId" | "status">;

type DatedItem = Omit<FocusItem, "minutes">;

const MIN_MINUTES_GAINED = 1;

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

function findFirstDue(items: readonly DatedItem[]): number | null {
  return items.reduce<number | null>((earliest, item) => {
    const time = item.scheduledFor?.getTime() ?? null;
    return time === null ? earliest : Math.min(earliest ?? time, time);
  }, null);
}

function findLastDue(items: readonly DatedItem[]): number | null {
  return items.reduce<number | null>((latest, item) => {
    const time = item.scheduledFor?.getTime() ?? null;
    return time === null ? latest : Math.max(latest ?? time, time);
  }, null);
}

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

type LessonItem = DatedItem & { lessonId: string | null };

function getLessonKey(item: LessonItem): string {
  return item.lessonId ?? `skill:${item.skillId ?? ""}`;
}

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
