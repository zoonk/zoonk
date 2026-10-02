type Vector = { x: number; y: number };

const HALF_TURN = 180;
const LABEL_GAP = 14;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / HALF_TURN;
}

function unit(from: Vector, to: Vector): Vector {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

function along(origin: Vector, direction: number, distance: number): Vector {
  return {
    x: origin.x + Math.cos(direction) * distance,
    y: origin.y + Math.sin(direction) * distance,
  };
}

function round(value: number): string {
  return value.toFixed(2);
}

function arcPath({
  center,
  from,
  radius,
  sweep,
  to,
}: {
  center: Vector;
  from: number;
  radius: number;
  sweep: number;
  to: number;
}): string {
  const [start, end] = [along(center, from, radius), along(center, to, radius)];
  const large = Math.abs(sweep) > Math.PI ? 1 : 0;
  const clockwise = sweep > 0 ? 1 : 0;

  return `M${round(center.x)} ${round(center.y)} L${round(start.x)} ${round(start.y)} A${radius} ${radius} 0 ${large} ${clockwise} ${round(end.x)} ${round(end.y)} Z`;
}

/**
 * The wedge marking a corner's inside angle on screen (y pointing down), and where its label
 * goes: along the middle of the angle, just past the wedge. The wedge turns from the next side
 * toward the previous one through the inside of the shape.
 */
export function cornerWedge({
  angle,
  corner,
  next,
  previous,
  radius,
}: {
  angle: number;
  corner: Vector;
  next: Vector;
  previous: Vector;
  radius: number;
}): { label: Vector; path: string } {
  const [toNext, toPrevious] = [unit(corner, next), unit(corner, previous)];
  const from = Math.atan2(toNext.y, toNext.x);

  const shortTurn = Math.atan2(
    toNext.x * toPrevious.y - toNext.y * toPrevious.x,
    toNext.x * toPrevious.x + toNext.y * toPrevious.y,
  );

  /* The short way round is the inside for a corner under 180°; a dent goes the long way. */
  const direction = Math.sign(shortTurn) || 1;
  const sweep = angle > HALF_TURN ? -direction * toRadians(angle) : direction * toRadians(angle);

  return {
    label: along(corner, from + sweep / 2, radius + LABEL_GAP),
    path: arcPath({ center: corner, from, radius, sweep, to: from + sweep }),
  };
}

/**
 * The corners torn off and laid side by side around one point, starting from the left along a
 * line and turning over the top, so a triangle's three angles visibly fill a straight line.
 */
export function fanWedges({
  angles,
  center,
  radius,
}: {
  angles: readonly number[];
  center: Vector;
  radius: number;
}): string[] {
  const offsets = angles.map((_, index) =>
    angles.slice(0, index).reduce((sum, angle) => sum + angle, 0),
  );

  return angles.map((angle, index) => {
    const from = Math.PI + toRadians(offsets[index] ?? 0);
    const sweep = toRadians(angle);

    return arcPath({ center, from, radius, sweep, to: from + sweep });
  });
}
