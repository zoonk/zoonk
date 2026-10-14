import { type PlanOperation } from "../plan-contract";
import { type UnfundedMove } from "../plan-error-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type ExistingPlanItem, type PlannedItem } from "../planner/plan-items";
import { type MovedEvent, type PlanState } from "../planner/plan-state";

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
 * Whether a learner's move takes the week's checkpoint or mock to a day that already holds one the
 * plan keeps: a day holds one (see `findMoveTo`), so the move is refused rather than dropping
 * either. The event's own earlier move to that day isn't one.
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
  const held = new Set(
    items.flatMap((item) =>
      (item.kind === "checkpoint" || item.kind === "mock") &&
      item.status === "todo" &&
      item.scheduledFor
        ? [toIsoDate(item.scheduledFor)]
        : [],
    ),
  );

  return operations.some(
    (operation) =>
      operation.kind === "moveWeeklyEvent" &&
      held.has(operation.to) &&
      !moves.some((move) => move.from === operation.from && move.to === operation.to),
  );
}

/**
 * A mock a learner's move takes to a day whose study days before it can't set aside its time (see
 * `fundMocks`): its new day and its real length there. Null when every move is funded.
 */
export function findUnfundedMove({
  operations,
  unfunded,
}: {
  operations: readonly PlanOperation[];
  unfunded: readonly UnfundedMove[];
}): UnfundedMove | null {
  const moved = new Set(
    operations.flatMap((operation) => (operation.kind === "moveWeeklyEvent" ? [operation.to] : [])),
  );

  return unfunded.find((mock) => moved.has(mock.date)) ?? null;
}

/**
 * The days a change asks the week's events to move to: its state's moves the saved plan doesn't
 * have. A mock there is funded on that day or refused (`unfundedMove`), never moved on (see
 * `findRelocation`). Absent when it moves nothing.
 */
export function listRequestedMoveDates({
  saved,
  state,
}: {
  saved: Pick<PlanState, "settings">;
  state: Pick<PlanState, "settings">;
}): ReadonlySet<string> | undefined {
  const requested = state.settings.movedEvents.filter(
    (move) =>
      !saved.settings.movedEvents.some((old) => old.from === move.from && old.to === move.to),
  );

  return requested.length > 0 ? new Set(requested.map((move) => move.to)) : undefined;
}
