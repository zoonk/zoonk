import { type PlanOperation } from "../plan-contract";
import { type UnfundedMove } from "../plan-error-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type ExistingPlanItem, type PlannedItem } from "../planner/plan-items";
import { type MovedEvent } from "../planner/plan-state";

export function hasMissingWeeklyMove({
  items,
  operations,
}: {
  items: readonly PlannedItem[];
  operations: readonly PlanOperation[];
}): boolean {
  const days = new Set(
    items.flatMap((item) =>
      (item.kind === "checkpoint" || item.kind === "mock") &&
      item.status === "todo" &&
      item.scheduledFor
        ? [toIsoDate(item.scheduledFor)]
        : [],
    ),
  );

  return operations.some(
    (operation) => operation.kind === "moveWeeklyEvent" && !days.has(operation.to),
  );
}

export function hasWeeklyEventCollision({
  items,
  moves,
  operations,
}: {
  items: readonly Pick<ExistingPlanItem, "kind" | "scheduledFor" | "status">[];
  moves: readonly MovedEvent[];
  operations: readonly PlanOperation[];
}): boolean {
  const requested = operations.flatMap((operation) =>
    operation.kind === "moveWeeklyEvent" ? [operation] : [],
  );

  const held = new Set(
    items.flatMap((item) =>
      (item.kind === "checkpoint" || item.kind === "mock") &&
      item.status === "todo" &&
      item.scheduledFor
        ? [toIsoDate(item.scheduledFor)]
        : [],
    ),
  );

  const isSaved = (move: MovedEvent) =>
    moves.some((saved) => saved.from === move.from && saved.to === move.to);

  const kept = moves.filter((saved) => !requested.some((move) => move.from === saved.from));
  const destinations = [...kept, ...requested].map((move) => move.to);

  return requested.some(
    (move) =>
      !isSaved(move) &&
      (held.has(move.to) ||
        destinations.filter((to) => to === move.to).length > 1 ||
        destinations.includes(move.from)),
  );
}

type MovedItem = Pick<ExistingPlanItem, "kind" | "scheduledFor" | "status"> & {
  minutes?: number | null;
};

function findUnplacedMockMove({
  items,
  operations,
}: {
  items: readonly MovedItem[];
  operations: readonly PlanOperation[];
}): UnfundedMove | null {
  const [refused] = operations.flatMap((operation) => {
    if (operation.kind !== "moveWeeklyEvent") {
      return [];
    }

    const mock = items.find(
      (item) =>
        item.kind === "mock" &&
        item.status === "todo" &&
        item.scheduledFor !== null &&
        toIsoDate(item.scheduledFor) === operation.from,
    );

    return mock?.minutes ? [{ date: operation.to, minutes: mock.minutes }] : [];
  });

  return refused ?? null;
}

export function findUnfundedMove({
  items,
  operations,
  unfunded,
}: {
  items: readonly MovedItem[];
  operations: readonly PlanOperation[];
  unfunded: readonly UnfundedMove[];
}): UnfundedMove | null {
  const moved = new Set(
    operations.flatMap((operation) => (operation.kind === "moveWeeklyEvent" ? [operation.to] : [])),
  );

  return (
    unfunded.find((mock) => moved.has(mock.date)) ?? findUnplacedMockMove({ items, operations })
  );
}
