/** Shape builders that return SVG path data, so every part of a drawing is one kind of shape. */

const DEGREES = 180;

export function circle(cx: number, cy: number, radius: number): string {
  return ellipse({ cx, cy, rx: radius, ry: radius });
}

/** An ellipse, turned `rotate` degrees clockwise around its center. */
export function ellipse({
  cx,
  cy,
  rotate = 0,
  rx,
  ry,
}: {
  cx: number;
  cy: number;
  rotate?: number;
  rx: number;
  ry: number;
}): string {
  const angle = (rotate * Math.PI) / DEGREES;
  const dx = round(rx * Math.cos(angle));
  const dy = round(rx * Math.sin(angle));
  const halfTurn = `a${rx} ${ry} ${rotate} 1 0`;

  return `M${round(cx - dx)} ${round(cy - dy)} ${halfTurn} ${2 * dx} ${2 * dy} ${halfTurn} ${-(2 * dx)} ${-(2 * dy)} Z`;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function rect({
  height,
  radius = 0,
  width,
  x,
  y,
}: {
  height: number;
  radius?: number;
  width: number;
  x: number;
  y: number;
}): string {
  const corner = Math.min(radius, width / 2, height / 2);
  const turn = (dx: number, dy: number) => `a${corner} ${corner} 0 0 1 ${dx} ${dy}`;

  return [
    `M${x + corner} ${y}`,
    `H${x + width - corner}`,
    turn(corner, corner),
    `V${y + height - corner}`,
    turn(-corner, corner),
    `H${x + corner}`,
    turn(-corner, -corner),
    `V${y + corner}`,
    turn(corner, -corner),
    "Z",
  ].join(" ");
}

/** A small filled triangle at `tip`, pointing away from `from`, for the end of an arrow. */
export function arrowHead({
  from,
  size = 7,
  tip,
}: {
  from: readonly [number, number];
  size?: number;
  tip: readonly [number, number];
}): string {
  const [tx, ty] = tip;
  const angle = Math.atan2(ty - from[1], tx - from[0]);
  const spread = Math.PI / 7;

  const corner = (side: number) =>
    `${(tx - size * Math.cos(angle + side * spread)).toFixed(1)} ${(ty - size * Math.sin(angle + side * spread)).toFixed(1)}`;

  return `M${tx} ${ty} L${corner(1)} L${corner(-1)} Z`;
}

/** Points along an axis turned `rotate` degrees, for details laid inside a rotated ellipse. */
function alongAxis({
  cx,
  cy,
  offset,
  rotate,
  side,
}: {
  cx: number;
  cy: number;
  offset: number;
  rotate: number;
  side: number;
}): string {
  const angle = (rotate * Math.PI) / DEGREES;
  const x = cx + offset * Math.cos(angle) - side * Math.sin(angle);
  const y = cy + offset * Math.sin(angle) + side * Math.cos(angle);

  return `${round(x)} ${round(y)}`;
}

/** A zigzag along a rotated axis, like the folds inside a mitochondrion. */
export function zigzag({
  amplitude,
  cx,
  cy,
  length,
  rotate = 0,
  teeth,
}: {
  amplitude: number;
  cx: number;
  cy: number;
  length: number;
  rotate?: number;
  teeth: number;
}): string {
  const points = Array.from({ length: teeth * 2 + 1 }, (_, index) =>
    alongAxis({
      cx,
      cy,
      offset: -length / 2 + (length * index) / (teeth * 2),
      rotate,
      side: index % 2 === 0 ? amplitude : -amplitude,
    }),
  );

  return `M${points.join(" L")}`;
}

/** A straight line through a center, turned `rotate` degrees. */
export function axisLine({
  cx,
  cy,
  length,
  rotate = 0,
}: {
  cx: number;
  cy: number;
  length: number;
  rotate?: number;
}): string {
  const start = alongAxis({ cx, cy, offset: -length / 2, rotate, side: 0 });
  const end = alongAxis({ cx, cy, offset: length / 2, rotate, side: 0 });

  return `M${start} L${end}`;
}

/** An arc of a circle from one angle to another, in degrees clockwise from the right. */
export function arc({
  cx,
  cy,
  from,
  radius,
  to,
}: {
  cx: number;
  cy: number;
  from: number;
  radius: number;
  to: number;
}): string {
  const start = alongAxis({ cx, cy, offset: radius, rotate: from, side: 0 });
  const end = alongAxis({ cx, cy, offset: radius, rotate: to, side: 0 });
  const large = Math.abs(to - from) > DEGREES ? 1 : 0;

  return `M${start} A${radius} ${radius} 0 ${large} 1 ${end}`;
}

/** A point on a circle, in degrees clockwise from the right. */
export function onCircle({
  angle,
  cx,
  cy,
  radius,
}: {
  angle: number;
  cx: number;
  cy: number;
  radius: number;
}): [number, number] {
  const radians = (angle * Math.PI) / DEGREES;
  return [round(cx + radius * Math.cos(radians)), round(cy + radius * Math.sin(radians))];
}

const SPIRAL_STEPS_PER_TURN = 24;

/** A spiral winding inward, like a cochlea or a snail shell. */
export function spiral({
  cx,
  cy,
  fromRadius,
  start = 0,
  toRadius,
  turns,
}: {
  cx: number;
  cy: number;
  fromRadius: number;
  start?: number;
  toRadius: number;
  turns: number;
}): string {
  const steps = Math.round(turns * SPIRAL_STEPS_PER_TURN);

  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const share = index / steps;
    const angle = start + share * turns * 2 * DEGREES;

    const [x, y] = onCircle({
      angle,
      cx,
      cy,
      radius: fromRadius + (toRadius - fromRadius) * share,
    });

    return `${x} ${y}`;
  });

  return `M${points.join(" L")}`;
}
