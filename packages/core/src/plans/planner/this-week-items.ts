import { type BuildPlanInput } from "./build-plan";
import { getEndOfWeek, toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem, getItemKey } from "./plan-items";
import { type MovedEvent } from "./plan-state";
import { type QueueUnit } from "./plan-units";
import { withoutRepeatedTitles } from "./repeated-titles";

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

/**
 * A test-out moves where the learner stands, so a run that finds lessons tested out on days still
 * ahead lays the plan out again from today, as the learner's own changes do, instead of keeping
 * this week's days around the time it freed. That run dates them today, so the next run keeps
 * the week again.
 */
export function withTestOutsAhead(input: BuildPlanInput): BuildPlanInput {
  const testedOutAhead = input.items.some(
    (item) =>
      item.status === "testedOut" && item.scheduledFor !== null && item.scheduledFor > input.today,
  );

  return input.mode === "automatic" && testedOutAhead ? { ...input, mode: "forced" } : input;
}

/** The last day an automatic run keeps saved work on; one that keeps the rest keeps all of it. */
export function getLastKeptDay({
  input,
  keepsRest,
}: {
  input: BuildPlanInput;
  keepsRest: boolean;
}): Date | null {
  return keepsRest ? null : getEndOfWeek(input.today);
}

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

  const moved = listMovedWeeklyItemIds({ items: input.items, moves: input.settings.movedEvents });
  const end = getLastKeptDay({ input, keepsRest });

  return input.items.filter(
    (item) =>
      item.status === "todo" &&
      !moved.has(item.id) &&
      (end === null || (item.scheduledFor !== null && item.scheduledFor <= end)),
  );
}

export function getPendingOrder({
  finished,
  frozen,
  queue,
}: {
  finished: readonly ExistingPlanItem[];
  frozen: readonly ExistingPlanItem[];
  queue: readonly QueueUnit[];
}) {
  const finishedKeys = new Set(finished.map((item) => getItemKey(item)));

  return {
    finishedKeys,
    ordered: withoutRepeatedTitles({
      kept: [...finished, ...frozen],
      units: queue.filter((unit) => !finishedKeys.has(unit.key)),
    }),
    unitsByKey: new Map(queue.map((unit) => [unit.key, unit])),
  };
}

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
