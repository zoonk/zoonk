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
  const end = getEndOfWeek(input.today);

  return input.items.filter(
    (item) =>
      item.status === "todo" &&
      !moved.has(item.id) &&
      (keepsRest || (item.scheduledFor !== null && item.scheduledFor <= end)),
  );
}

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
