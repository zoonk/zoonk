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

function closestPoint(point: LabelPoint, { from, to }: LabelSegment): LabelPoint {
  const [dx, dy] = [to.x - from.x, to.y - from.y];

  const along =
    dx === 0 && dy === 0
      ? 0
      : ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx ** 2 + dy ** 2);

  const t = Math.max(0, Math.min(1, along));
  return { x: from.x + t * dx, y: from.y + t * dy };
}

function pointBoxGapSquared(point: LabelPoint, box: LabelBox): number {
  const x = Math.max(box.left - point.x, 0, point.x - box.right);
  const y = Math.max(box.top - point.y, 0, point.y - box.bottom);
  return x ** 2 + y ** 2;
}

export function segmentGapSquared(box: LabelBox, segment: LabelSegment): number {
  if (touchesSegment(box, segment, 0)) {
    return 0;
  }

  const cornerGap = (x: number, y: number) => {
    const nearest = closestPoint({ x, y }, segment);
    return (x - nearest.x) ** 2 + (y - nearest.y) ** 2;
  };

  return Math.min(
    pointBoxGapSquared(segment.from, box),
    pointBoxGapSquared(segment.to, box),
    cornerGap(box.left, box.top),
    cornerGap(box.left, box.bottom),
    cornerGap(box.right, box.top),
    cornerGap(box.right, box.bottom),
  );
}

export function edgeSpots(area: LabelBox, size: { width: number; height: number }): LabelBox[] {
  const right = area.right - size.width;
  const bottom = area.bottom - size.height;

  if (right < area.left || bottom < area.top) {
    return [];
  }

  const step = 0.25;

  const along = (start: number, end: number) =>
    Array.from({ length: Math.ceil((end - start) / step) + 1 }, (_, index) =>
      Math.min(end, start + index * step),
    );

  const at = (left: number, top: number) => ({
    bottom: top + size.height,
    left,
    right: left + size.width,
    top,
  });

  return [
    ...along(area.left, right).flatMap((x) => [at(x, area.top), at(x, bottom)]),
    ...along(area.top, bottom).flatMap((y) => [at(area.left, y), at(right, y)]),
  ];
}

function centerOf(box: LabelBox): LabelPoint {
  return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
}

function sideOf(point: LabelPoint, { from, to }: LabelSegment): number {
  return (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x);
}

export function isOnNamedSide(box: LabelBox, named: LabelSegment, line: LabelSegment): boolean {
  const center = centerOf(box);

  return sideOf(center, line) * sideOf(closestPoint(center, named), line) >= 0;
}

function separatesName(box: LabelBox, named: LabelSegment, line: LabelSegment): boolean {
  const center = centerOf(box);
  const connector = { from: center, to: closestPoint(center, named) };

  return (
    sideOf(connector.from, line) * sideOf(connector.to, line) < 0 &&
    sideOf(line.from, connector) * sideOf(line.to, connector) < 0
  );
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

export function measureDrawingLabel({
  element,
  pixelSize = 1,
}: {
  element: SVGTextElement;
  pixelSize?: number;
}): { height: number; width: number; offsetX: number; offsetY: number } {
  const box = element.getBBox();
  const inPixels = (value: number) => Number((value / pixelSize).toFixed(3));

  return {
    height: inPixels(box.height),
    offsetX: inPixels(box.x + box.width / 2 - Number(element.getAttribute("x"))),
    offsetY: inPixels(box.y + box.height / 2 - Number(element.getAttribute("y"))),
    width: inPixels(box.width),
  };
}

export function isInside(box: LabelBox, area: LabelBox): boolean {
  return (
    box.left >= area.left &&
    box.right <= area.right &&
    box.top >= area.top &&
    box.bottom <= area.bottom
  );
}

export function touchesBox(box: LabelBox, other: LabelBox, clearance = LABEL_CLEARANCE): boolean {
  return (
    box.left < other.right + clearance &&
    box.right > other.left - clearance &&
    box.top < other.bottom + clearance &&
    box.bottom > other.top - clearance
  );
}

export function belongsWith(
  box: LabelBox,
  named: LabelSegment,
  lines: readonly LabelSegment[],
  unobstructed = true,
): boolean {
  const own = segmentGapSquared(box, named);

  return lines.every(
    (line) =>
      line === named ||
      (own < segmentGapSquared(box, line) && (!unobstructed || !separatesName(box, named, line))),
  );
}
