export const RING_VIEW_BOX = 36;

const CENTER = RING_VIEW_BOX / 2;
const RADIUS = 17;
const FULL_TURN = 360;
const HALF_TURN = FULL_TURN / 2;
const GAP_DEGREES = 22;
const START_DEGREES = -90;

/** Rounded, so the server's path and the browser's are the same text. */
const POINT_DIGITS = 3;

function toPoint(degrees: number) {
  const radians = (degrees * Math.PI) / HALF_TURN;
  const x = CENTER + RADIUS * Math.cos(radians);
  const y = CENTER + RADIUS * Math.sin(radians);

  return `${x.toFixed(POINT_DIGITS)} ${y.toFixed(POINT_DIGITS)}`;
}

/** An arc over half the ring needs SVG's large-arc flag, or it's drawn the short way, as a dash across the gap. */
export function getArcPath({ index, total }: { index: number; total: number }): string {
  const span = FULL_TURN / total;
  const start = START_DEGREES + index * span + GAP_DEGREES / 2;
  const arcDegrees = span - GAP_DEGREES;
  const largeArc = arcDegrees > HALF_TURN ? 1 : 0;

  return `M ${toPoint(start)} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${toPoint(start + arcDegrees)}`;
}
