import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type MovedEvent } from "./plan-state";
import { type DayShape, type FixedEvent } from "./schedule-units";

/** The week's checkpoint or mock can move; phase checkpoints and review days keep their day. */
const MOVABLE_EVENT_KINDS = new Set<FixedEvent["kind"]>(["checkpoint", "mock"]);

function isMovable(event: FixedEvent): boolean {
  return MOVABLE_EVENT_KINDS.has(event.kind);
}

/**
 * The move that brings a day its week's event: a day holds one, so of moves a plan saved to the
 * same day before a second was refused, the one from the earliest day, the others' events dropped.
 */
export function findMoveTo({
  date,
  moves,
}: {
  date: string;
  moves: readonly MovedEvent[];
}): MovedEvent | undefined {
  return moves
    .filter((move) => move.to === date)
    .toSorted((a, b) => a.from.localeCompare(b.from))
    .at(0);
}

/**
 * Days with the learner's moves applied ("Move to Monday"): the week's checkpoint or mock leaves
 * its day, which gets its lessons back, and lands on the later day. It's keyed by its new day, the
 * way a dated item is known across planning runs, so later runs keep it as the same item. A moved
 * mock takes its new day whole (`replacesDay`): the review there gives way, and so does the week's
 * event the day had (a day holds one, the learner's), while what else it keeps (a phase's
 * checkpoint) stays beside it. It sits there as its new day's phase has it
 * (`resolveMoved`: all of its exam day in the final stretch).
 */
export function withMovedEvents({
  describeDay,
  moves,
  resolveMoved = (event) => event,
}: {
  describeDay: (date: Date) => DayShape;
  moves: readonly MovedEvent[];
  /** A moved event as its new day has it. */
  resolveMoved?: (event: FixedEvent, date: Date) => FixedEvent;
}): (date: Date) => DayShape {
  if (moves.length === 0) {
    return describeDay;
  }

  return (date) => {
    const day = toIsoDate(date);
    const shape = describeDay(date);
    const movedOut = moves.some((move) => move.from === day);

    const moveIn = findMoveTo({ date: day, moves });

    const movedIn = moveIn
      ? describeDay(fromIsoDate(moveIn.from))
          .events.filter(isMovable)
          .map((event) => resolveMoved({ ...event, key: `${event.kind}:${moveIn.to}` }, date))
      : [];

    if (!movedOut && movedIn.length === 0) {
      return shape;
    }

    const replaces = movedIn.some((event) => event.replacesDay);
    const takenOver = movedOut || movedIn.length > 0;

    const staying = shape.events.filter(
      (event) => !(takenOver && isMovable(event)) && !(replaces && event.kind === "review"),
    );

    return { ...shape, events: [...staying, ...movedIn] };
  };
}
