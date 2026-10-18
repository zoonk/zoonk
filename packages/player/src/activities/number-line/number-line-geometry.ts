/** How high a jump arcs for each pixel it covers, and the tallest it gets. */
const ARC_RISE = 0.45;
const MAX_ARC_HEIGHT = 64;
const MIN_ARC_HEIGHT = 18;
const HEAD_LENGTH = 7;
const HEAD_ANGLE_DEGREES = 30;
const DEGREES_PER_HALF_TURN = 180;
const HEAD_ANGLE = (HEAD_ANGLE_DEGREES * Math.PI) / DEGREES_PER_HALF_TURN;
const FLOAT_SLACK = 1e-9;
const MAX_LABELLED_TICKS = 13;

type JumpArc = { head: string; labelX: number; labelY: number; path: string };

/**
 * A jump drawn as an arc over the number line from one pixel to another, with an arrowhead that
 * follows the arc's direction where it lands. Longer jumps arc higher, so a chain of jumps reads
 * as separate hops.
 */
export function jumpArc({
  baseline,
  from,
  to,
}: {
  baseline: number;
  from: number;
  to: number;
}): JumpArc {
  const height = Math.min(Math.max(Math.abs(to - from) * ARC_RISE, MIN_ARC_HEIGHT), MAX_ARC_HEIGHT);
  const controlX = (from + to) / 2;
  const controlY = baseline - 2 * height;
  const angle = Math.atan2(baseline - controlY, to - controlX);

  const wing = (side: number) => {
    const wingAngle = angle + Math.PI + side * HEAD_ANGLE;
    return `${(to + HEAD_LENGTH * Math.cos(wingAngle)).toFixed(2)} ${(baseline + HEAD_LENGTH * Math.sin(wingAngle)).toFixed(2)}`;
  };

  return {
    head: `M${wing(-1)} L${to} ${baseline} L${wing(1)}`,
    labelX: controlX,
    labelY: baseline - height - HEAD_LENGTH,
    path: `M${from} ${baseline} Q${controlX} ${controlY} ${to} ${baseline}`,
  };
}

/** Every stop of the writer's jumps, starting point first: where each arc begins and ends. */
export function jumpStops(start: number, moves: readonly { by: number }[]): number[] {
  return moves.reduce<number[]>(
    (stops, move) => {
      stops.push((stops.at(-1) ?? start) + move.by);
      return stops;
    },
    [start],
  );
}

/** Tick values from min to max; long lines label every other tick so labels never collide. */
export function numberLineTicks({ max, min, step }: { max: number; min: number; step: number }) {
  const count = Math.floor((max - min) / step + FLOAT_SLACK);

  const values = Array.from({ length: count + 1 }, (_, index) =>
    Number((min + index * step).toPrecision(12)),
  );

  const labelEvery = values.length > MAX_LABELLED_TICKS ? 2 : 1;

  return values.map((value, index) => ({
    isLabelled: index % labelEvery === 0 || value === 0,
    value,
  }));
}
