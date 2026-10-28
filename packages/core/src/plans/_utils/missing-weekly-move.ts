import { type PlanOperation } from "../plan-contract";
import { type UnfundedMove } from "../plan-error-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type ExistingPlanItem, type PlannedItem } from "../planner/plan-items";
import { type MovedEvent } from "../planner/plan-state";

/** A move can be saved only when the planner actually places its challenge on the requested day. */
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

/**
 * Whether a learner's moves would put two weekly events on one day, which is refused before
 * planning (R43): a move onto a day that holds a checkpoint or mock the plan keeps (the event's own
 * earlier move there aside), onto a day another move takes an event to (one in this change or one
 * saved), or of an event a move already brought (a chain: its first move stays its only one).
 * Allowed, the planner kept one event per day and silently dropped the others with their credits.
 */
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

  // Saved moves this change doesn't replace (moving the same day again replaces its move).
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

/**
 * A mock a learner's move asked for that the plan couldn't place on its new day, with its length as the
 * plan holds it. Null for a move of anything else, or without a length.
 */
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

/**
 * A mock a learner's move takes to a day whose study days before it can't set aside its time (see
 * `fundMocks`): its new day and its real length there. One the plan couldn't place there at all is
 * refused the same way (`findUnplacedMockMove`), since asking again can only be refused again.
 * Null when every move is funded and placed.
 */
export function findUnfundedMove({
  items,
  operations,
  unfunded,
}: {
  /** The saved plan's items, where a moved mock's length comes from. */
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
