import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type MovedEvent } from "./plan-state";
import { type DayShape, type FixedEvent } from "./schedule-units";

const MOVABLE_EVENT_KINDS = new Set<FixedEvent["kind"]>(["checkpoint", "mock"]);

function isMovable(event: FixedEvent): boolean {
  return MOVABLE_EVENT_KINDS.has(event.kind);
}

export function withMovedEvents({
  describeDay,
  moves,
  resolveMoved = (event) => event,
}: {
  describeDay: (date: Date) => DayShape;
  moves: readonly MovedEvent[];
  resolveMoved?: (event: FixedEvent, date: Date) => FixedEvent;
}): (date: Date) => DayShape {
  if (moves.length === 0) {
    return describeDay;
  }

  return (date) => {
    const day = toIsoDate(date);
    const shape = describeDay(date);
    const movedOut = moves.some((move) => move.from === day);

    const moveIn = moves.find((move) => move.to === day);

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

    const staying = shape.events
      .filter((event) => !(takenOver && isMovable(event)) && !(replaces && event.kind === "review"))
      .map((event) =>
        replaces && event.kind === "boss" ? { ...event, beside: true, leads: undefined } : event,
      );

    return { ...shape, events: [...staying, ...movedIn] };
  };
}
