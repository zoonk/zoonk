import { clamp } from "../_utils/snap-value";
import { type Point } from "./line-crossing-model";

export type LabelBox = { bottom: number; left: number; right: number; top: number };
type LabelCircle = { cx: number; cy: number; radius: number };
export type LabelSize = { height: number; width: number };
type LabelSegment = { from: Point; to: Point };
type LineLabel = { isUpper: boolean; segment: LabelSegment; size: LabelSize };

const LABEL_GAP = 8;
const CLEARANCE = 3;
const STEPS_PER_LABEL_HEIGHT = 6;
const SEARCH_STEPS = 30;
const CLEAR_OF_ALL_STEPS = 12;

const NEAREST_SHIFTS = Array.from({ length: (SEARCH_STEPS * 2 + 1) ** 2 }, (_, index) => ({
  x: (index % (SEARCH_STEPS * 2 + 1)) - SEARCH_STEPS,
  y: Math.floor(index / (SEARCH_STEPS * 2 + 1)) - SEARCH_STEPS,
})).toSorted((first, second) => Math.hypot(first.x, first.y) - Math.hypot(second.x, second.y));

function shifted(box: LabelBox, { x, y }: Point, step: number): LabelBox {
  return {
    bottom: box.bottom + y * step,
    left: box.left + x * step,
    right: box.right + x * step,
    top: box.top + y * step,
  };
}

function spotsAcross(area: LabelBox, start: LabelBox): LabelBox[] {
  const [width, height] = [start.right - start.left, start.bottom - start.top];
  const columns = Math.floor((area.right - area.left - width) / height) + 1;
  const rows = Math.floor((area.bottom - area.top - height) / height) + 1;

  if (columns < 1 || rows < 1) {
    return [];
  }

  return Array.from({ length: columns * rows }, (_, index) => {
    const left = area.left + (index % columns) * height;
    const top = area.top + Math.floor(index / columns) * height;
    return { bottom: top + height, left, right: left + width, top };
  }).toSorted(
    (first, second) =>
      Math.hypot(first.left - start.left, first.top - start.top) -
      Math.hypot(second.left - start.left, second.top - start.top),
  );
}

function isInside(box: LabelBox, area: LabelBox): boolean {
  return (
    box.left >= area.left &&
    box.right <= area.right &&
    box.top >= area.top &&
    box.bottom <= area.bottom
  );
}

function touchesSegment(box: LabelBox, { from, to }: LabelSegment): boolean {
  const top = box.top - CLEARANCE;
  const bottom = box.bottom + CLEARANCE;
  const low = Math.max(top, Math.min(from.y, to.y));
  const high = Math.min(bottom, Math.max(from.y, to.y));

  if (low > high) {
    return false;
  }

  const xAt = (y: number) => from.x + ((y - from.y) / (to.y - from.y)) * (to.x - from.x);
  const xs = from.y === to.y ? [from.x, to.x] : [xAt(low), xAt(high)];

  return Math.max(...xs) >= box.left - CLEARANCE && Math.min(...xs) <= box.right + CLEARANCE;
}

function touchesCircle(box: LabelBox, { cx, cy, radius }: LabelCircle): boolean {
  const nearest = { x: clamp(cx, box.left, box.right), y: clamp(cy, box.top, box.bottom) };
  return Math.hypot(nearest.x - cx, nearest.y - cy) < radius + CLEARANCE;
}

function touchesBox(box: LabelBox, other: LabelBox): boolean {
  return (
    box.left < other.right + CLEARANCE &&
    box.right > other.left - CLEARANCE &&
    box.top < other.bottom + CLEARANCE &&
    box.bottom > other.top - CLEARANCE
  );
}

function besideEnd({ isUpper, segment, size }: LineLabel, area: LabelBox): LabelBox {
  const [lower, upper] =
    segment.from.y > segment.to.y ? [segment.from, segment.to] : [segment.to, segment.from];

  const end = isUpper ? upper : lower;

  const left =
    end.x < (area.left + area.right) / 2 ? end.x + LABEL_GAP : end.x - LABEL_GAP - size.width;

  const top = isUpper ? end.y - LABEL_GAP - size.height : end.y + LABEL_GAP;

  return { bottom: top + size.height, left, right: left + size.width, top };
}

type LabelMarks = {
  circles: readonly LabelCircle[];
  lines: readonly LabelSegment[];
  segments: readonly LabelSegment[];
};

function placeLineLabel({
  area,
  label,
  marks,
  placed,
}: {
  area: LabelBox;
  label: LineLabel;
  marks: LabelMarks;
  placed: readonly LabelBox[];
}): LabelBox {
  const start = besideEnd(label, area);
  const step = label.size.height / STEPS_PER_LABEL_HEIGHT;

  const clearsMarks = (box: LabelBox) =>
    marks.segments.every((segment) => !touchesSegment(box, segment)) &&
    marks.circles.every((circle) => !touchesCircle(box, circle)) &&
    placed.every((other) => !touchesBox(box, other));

  const fits = (box: LabelBox, lines: readonly LabelSegment[]) =>
    isInside(box, area) &&
    [label.segment, ...lines].every((segment) => !touchesSegment(box, segment));

  const isClear = (box: LabelBox) => fits(box, []) && clearsMarks(box);
  const offItsLine = (box: LabelBox) => fits(box, []);

  const nearby = [
    (box: LabelBox, shift: Point) =>
      Math.hypot(shift.x, shift.y) <= CLEAR_OF_ALL_STEPS &&
      fits(box, marks.lines) &&
      clearsMarks(box),
    isClear,
    offItsLine,
  ].reduce<Point | null>(
    (found, pass) =>
      found ??
      NEAREST_SHIFTS.find((candidate) => pass(shifted(start, candidate, step), candidate)) ??
      null,
    null,
  );

  if (nearby) {
    return shifted(start, nearby, step);
  }

  const spots = spotsAcross(area, start);
  return spots.find((box) => isClear(box)) ?? spots.find((box) => offItsLine(box)) ?? start;
}

/**
 * Where each line's name sits, in order: by its end of the line on the open side, or at the
 * nearest spot that clears the lines, the marks (drag handles, crossings, arrows) and the names
 * placed before it. When no spot close by clears every line, it keeps off its own line and the
 * marks, then just off its own line, searching the whole chart when nothing near is free. Its
 * halo never cuts the line it names: with no free spot anywhere it stays by its end, on the line's
 * open side.
 */
export function placeLineLabels({
  area,
  labels,
  marks,
  placed = [],
}: {
  area: LabelBox;
  labels: readonly LineLabel[];
  marks: LabelMarks;
  placed?: readonly LabelBox[];
}): LabelBox[] {
  const [label, ...rest] = labels;

  if (!label) {
    return [...placed];
  }

  const box = placeLineLabel({ area, label, marks, placed });
  return placeLineLabels({ area, labels: rest, marks, placed: [...placed, box] });
}
