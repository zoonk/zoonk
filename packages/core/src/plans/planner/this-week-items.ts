import { type AfterExamSpan } from "./after-exam";
import { type BuildPlanInput } from "./build-plan";
import { getRequestedMoves } from "./committed-mock-funding";
import { type StudyPortion } from "./interval-study-minutes";
import { fromIsoDate, getEndOfWeek, toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem, type PlannedItem, getItemKey } from "./plan-items";
import { buildPlanQueue } from "./plan-queue";
import { type MovedEvent } from "./plan-state";
import { type QueueUnit } from "./plan-units";
import { withoutRepeatedTitles } from "./repeated-titles";

/**
 * The source rows an automatic run releases from the saved week when the learner moves them.
 * Keeping a source row would put it back beside its new Monday and make Undo ambiguous.
 */
function listMovedWeeklyItemIds({
  items,
  moves,
}: {
  items: readonly ExistingPlanItem[];
  moves: readonly MovedEvent[];
}): Set<string> {
  const from = new Set(moves.map((move) => move.from));

  return new Set(
    items.flatMap((item) =>
      (item.kind === "checkpoint" || item.kind === "mock") &&
      item.scheduledFor &&
      from.has(toIsoDate(item.scheduledFor))
        ? [item.id]
        : [],
    ),
  );
}

/** An automatic run keeps the saved week, except a weekly event explicitly moved out of it. */
export function listThisWeekItems({
  input,
  keepsRest,
}: {
  input: BuildPlanInput;
  keepsRest: boolean;
}): ExistingPlanItem[] {
  if (input.mode !== "automatic") {
    return [];
  }

  const moves = input.keepSelection
    ? getRequestedMoves({
        moves: input.settings.movedEvents,
        requested: input.requestedMoveDates ?? new Set(),
      })
    : input.settings.movedEvents;

  const moved = listMovedWeeklyItemIds({ items: input.items, moves });

  const mockSources = new Set(
    input.items
      .filter((item) => item.kind === "mock" && item.scheduledFor)
      .map((item) => item.scheduledFor && toIsoDate(item.scheduledFor)),
  );

  const reviews = new Set(
    input.keepSelection
      ? moves.filter((move) => mockSources.has(move.from)).map((move) => move.to)
      : [],
  );

  const end = getEndOfWeek(input.today);

  return input.items.filter(
    (item) =>
      item.status === "todo" &&
      !moved.has(item.id) &&
      !(item.kind === "review" && item.scheduledFor && reviews.has(toIsoDate(item.scheduledFor))) &&
      (keepsRest || (item.scheduledFor !== null && item.scheduledFor <= end)),
  );
}

/** Pending work keeps its teaching order after completed work and repeated titles are removed. */
export function getPendingOrder({
  finished,
  queue,
}: {
  finished: readonly ExistingPlanItem[];
  queue: readonly QueueUnit[];
}) {
  const finishedKeys = new Set(finished.map((item) => getItemKey(item)));

  return {
    finishedKeys,
    ordered: withoutRepeatedTitles({
      kept: finished,
      units: queue.filter((unit) => !finishedKeys.has(unit.key)),
    }),
    unitsByKey: new Map(queue.map((unit) => [unit.key, unit])),
  };
}

/** A local edit can queue only the work the saved plan actually selected. */
export function getRunQueue(input: BuildPlanInput) {
  const queue = buildPlanQueue(input);
  const selected = new Set(input.items.map((item) => getItemKey(item)));

  return input.keepSelection
    ? { ...queue, units: queue.units.filter((unit) => selected.has(unit.key)) }
    : queue;
}

/** Work already set aside stays out unless this run actually placed it. */
export function listStillSetAside({
  items,
  placed,
}: {
  items: readonly ExistingPlanItem[];
  placed: readonly Pick<QueueUnit, "key">[];
}): ExistingPlanItem[] {
  const keys = new Set(placed.map((unit) => unit.key));
  return items.filter((item) => !keys.has(getItemKey(item)));
}

/** Only selected teaching within the local interval may be re-placed. */
export function listIntervalTeaching({
  interval,
  items,
  portions,
}: {
  interval: { from: string; to: string };
  items: readonly ExistingPlanItem[];
  portions: ReadonlyMap<string, readonly StudyPortion[]>;
}): Map<string, StudyPortion[]> {
  const teaching = new Set(items.map((item) => getItemKey(item)));

  return new Map(
    [...portions].flatMap(([key, parts]) => {
      const released = teaching.has(key)
        ? parts.filter((part) => part.date >= interval.from && part.date <= interval.to)
        : [];

      return released.length > 0 ? [[key, released]] : [];
    }),
  );
}

/** A local edit keeps the continuation's actual saved allocations without scheduling it again. */
export function getKeptAfterExamSpan({
  input,
  items,
  portions,
}: {
  input: BuildPlanInput;
  items: readonly PlannedItem[];
  portions: ReadonlyMap<string, readonly StudyPortion[]>;
}): AfterExamSpan | null {
  const exam = input.goal.targetDate;

  if (!input.keepSelection || !input.settings.fullCourse || input.goal.kind !== "exam" || !exam) {
    return null;
  }

  const after = items.flatMap((item): Pick<StudyPortion, "date" | "minutes">[] => {
    const study = portions.get(getItemKey(item));

    if (study) {
      return study.filter((part) => part.date > toIsoDate(exam));
    }

    return item.scheduledFor && item.scheduledFor > exam
      ? [{ date: toIsoDate(item.scheduledFor), minutes: item.minutes }]
      : [];
  });

  const dates = after.map((part) => part.date).toSorted();
  const first = dates[0];
  const last = dates.at(-1);

  return first && last
    ? {
        end: fromIsoDate(last),
        minutes: after.reduce((sum, part) => sum + part.minutes, 0),
        start: fromIsoDate(first),
      }
    : null;
}
