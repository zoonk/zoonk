import { type BuildPlanInput } from "./build-plan";
import { type StudyPortion } from "./interval-study-minutes";
import { fixedPortions, isTeaching } from "./pinned-study-portions";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem, getItemKey } from "./plan-items";
import { type PlanDay } from "./schedule-units";

type Portions = ReadonlyMap<string, readonly StudyPortion[]>;

/**
 * A teaching item's lane: the work it continues in order, its skill's. Lessons of other skills run
 * in parallel lanes, so a moved piece can pass them, as the planner interleaves them itself; what
 * it builds on keeps coming first (see `breaksPrerequisitesFirst`).
 */
function getLane(item: ExistingPlanItem): string {
  return item.skillId ?? "";
}

/** Where each teaching item stands in the saved order, and each lane's items in that order. */
export type TeachingOrder = {
  lanes: Map<string, ExistingPlanItem[]>;
  position: Map<ExistingPlanItem, number>;
};

export function getTeachingOrder(input: BuildPlanInput): TeachingOrder {
  const teaching = input.items.filter((item) => isTeaching(item));

  return {
    lanes: Map.groupBy(teaching, (item) => getLane(item)),
    position: new Map(teaching.map((item, index) => [item, index])),
  };
}

/**
 * How far a lane's earlier item had come by `date`, so a later item's piece never goes before it:
 * its last day of work by then, or of the work this edit placed again; none when it starts later.
 */
function getProgressBy({
  date,
  fitted,
  input,
  item,
  portions,
}: {
  date: string;
  fitted: ReadonlyMap<string, string>;
  input: BuildPlanInput;
  item: ExistingPlanItem;
  portions: Portions;
}): number {
  if (item.status !== "todo") {
    return (input.finishedOn?.get(item.id) ?? input.today).getTime();
  }

  const placed = fitted.get(getItemKey(item));

  if (placed) {
    return fromIsoDate(placed).getTime();
  }

  const own = portions.get(getItemKey(item));
  const due = item.scheduledFor && toIsoDate(item.scheduledFor) <= date ? item.scheduledFor : null;
  const last = own ? own.findLast((part) => part.date <= date)?.date : null;

  return last ? fromIsoDate(last).getTime() : (due?.getTime() ?? 0);
}

/** When a lane's later item next has work from `date` on: an earlier item's piece stays before. */
function getNextWork({
  date,
  item,
  portions,
}: {
  date: string;
  item: ExistingPlanItem;
  portions: Portions;
}): number {
  const own = portions.get(getItemKey(item));
  const due = item.scheduledFor && toIsoDate(item.scheduledFor) >= date ? item.scheduledFor : null;
  const next = own ? own.find((part) => part.date >= date)?.date : null;

  return next ? fromIsoDate(next).getTime() : (due?.getTime() ?? Infinity);
}

/**
 * The days a displaced piece can take: after its own earlier work and its lane's work up to its
 * day, and before its own later work, its lane's next work, its phase's challenge and `cap` (the
 * next later weekly event or the goal's date, which test it).
 */
export function getBounds({
  cap,
  displaced,
  fitted,
  input,
  item,
  order,
  portions,
}: {
  cap: number;
  displaced: Portions;
  /** The last day of each item this edit placed again. */
  fitted: ReadonlyMap<string, string>;
  input: BuildPlanInput;
  item: ExistingPlanItem;
  order: TeachingOrder;
  portions: Portions;
}) {
  const index = order.position.get(item) ?? 0;
  const lane = order.lanes.get(getLane(item)) ?? [];
  const removed = displaced.get(getItemKey(item)) ?? [];
  const first = removed[0]?.date ?? "";
  const last = removed.at(-1)?.date ?? "";
  const earlier = lane.filter((other) => (order.position.get(other) ?? 0) < index);

  const later = lane.filter(
    (other) =>
      (order.position.get(other) ?? 0) > index &&
      other.status === "todo" &&
      !displaced.has(getItemKey(other)),
  );

  const boss = input.items.find(
    (other) => other.kind === "boss" && other.phase === item.phase && other.status === "todo",
  );

  const own = fixedPortions({ displaced, key: getItemKey(item), portions });
  const ownBefore = own.findLast((part) => part.date < first);
  const ownAfter = own.find((part) => part.date > last);

  const progress = earlier.map((other) =>
    getProgressBy({ date: first, fitted, input, item: other, portions }),
  );

  return {
    from: Math.max(
      input.today.getTime(),
      ownBefore ? fromIsoDate(ownBefore.date).getTime() : 0,
      ...progress,
    ),
    until: Math.min(
      ownAfter ? fromIsoDate(ownAfter.date).getTime() : Infinity,
      ...later.map((other) => getNextWork({ date: last, item: other, portions })),
      boss?.scheduledFor?.getTime() ?? Infinity,
      // Strictly before the event or date that tests the work.
      cap - 1,
    ),
  };
}

/**
 * The day moved work must stay before (LEAD rule 2): the next later weekly mock or checkpoint,
 * which tests it, or the goal's date; none past the plan's days otherwise.
 */
export function getMoveCap({
  days,
  input,
  to,
}: {
  days: readonly PlanDay[];
  input: BuildPlanInput;
  to: string;
}): number {
  const next = days.find(
    (day) =>
      toIsoDate(day.date) > to &&
      day.shape.events.some((event) => event.kind === "mock" || event.kind === "checkpoint"),
  );

  return Math.min(next?.date.getTime() ?? Infinity, input.goal.targetDate?.getTime() ?? Infinity);
}
