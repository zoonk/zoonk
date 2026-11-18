export const DRAWING_LABEL_HALO =
  "[paint-order:stroke] stroke-background stroke-[4px] [stroke-linejoin:round]";

export type LabelAnchor = "end" | "middle" | "start";
export type LabelBox = { bottom: number; left: number; right: number; top: number };
export type LabelPoint = { x: number; y: number };
export type LabelSegment = { from: LabelPoint; to: LabelPoint };

/** The room a label's halo needs between it and a line, so the line never shows through it. */
export const LABEL_CLEARANCE = 3;

const LABEL_CHARACTER_WIDTH = 7;

/** A 12px label's width before it's drawn, generous so a guess never lets it pass an edge. */
export function estimatedLabelWidth(text: string): number {
  return text.length * LABEL_CHARACTER_WIDTH;
}

/** An axis label is centered on its tick, unless that would take it past an end of its axis: then it starts or ends at its tick. */
export function edgeAnchor({
  at,
  range,
  width,
}: {
  at: number;
  range: readonly [number, number];
  width: number;
}): LabelAnchor {
  if (at - width / 2 < range[0]) {
    return "start";
  }

  return at + width / 2 > range[1] ? "end" : "middle";
}

export function touchesSegment(
  box: LabelBox,
  { from, to }: LabelSegment,
  clearance = LABEL_CLEARANCE,
): boolean {
  const top = box.top - clearance;
  const bottom = box.bottom + clearance;
  const low = Math.max(top, Math.min(from.y, to.y));
  const high = Math.min(bottom, Math.max(from.y, to.y));

  if (low > high) {
    return false;
  }

  const xAt = (y: number) => from.x + ((y - from.y) / (to.y - from.y)) * (to.x - from.x);
  const xs = from.y === to.y ? [from.x, to.x] : [xAt(low), xAt(high)];

  return Math.max(...xs) >= box.left - clearance && Math.min(...xs) <= box.right + clearance;
}

export function closestPoint(point: LabelPoint, { from, to }: LabelSegment): LabelPoint {
  const [dx, dy] = [to.x - from.x, to.y - from.y];

  const along =
    dx === 0 && dy === 0
      ? 0
      : ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx ** 2 + dy ** 2);

  const t = Math.max(0, Math.min(1, along));
  return { x: from.x + t * dx, y: from.y + t * dy };
}

export function isOnNamedSide(
  box: LabelBox,
  named: LabelSegment,
  { from, to }: LabelSegment,
): boolean {
  const center = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };

  const side = (point: LabelPoint) =>
    (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x);

  return side(center) * side(closestPoint(center, named)) >= 0;
}

function touchesLine(box: LabelBox, line: readonly LabelPoint[]): boolean {
  return line.some((from, index) => {
    const to = line[index + 1];
    return to !== undefined && touchesSegment(box, { from, to });
  });
}

/** A mark's label goes above it, or below it when its line runs through the spot above and leaves the one below clear. */
export function sideOffLine({
  gap,
  line,
  mark,
  size,
}: {
  gap: number;
  line: readonly LabelPoint[];
  mark: LabelPoint;
  size: { height: number; width: number };
}): "above" | "below" {
  const [left, right] = [mark.x - size.width / 2, mark.x + size.width / 2];
  const above = { bottom: mark.y - gap, left, right, top: mark.y - gap - size.height };
  const below = { bottom: mark.y + gap + size.height, left, right, top: mark.y + gap };

  return touchesLine(above, line) && !touchesLine(below, line) ? "below" : "above";
}
