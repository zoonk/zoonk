import { clamp } from "../_utils/snap-value";
import { type Point } from "./line-crossing-model";

export type LabelBox = { bottom: number; left: number; right: number; top: number };
type LabelCircle = { cx: number; cy: number; radius: number };
export type LabelSize = { height: number; width: number };
type LabelSegment = { from: Point; to: Point };
type LineLabel = { isUpper: boolean; segment: LabelSegment; size: LabelSize };

const LABEL_GAP = 8;
const CLEARANCE = 3;
const SEARCH_STEP = 2;
const SEARCH_STEPS = 30;
const CLEAR_OF_ALL_REACH = 24;

const NEAREST_SHIFTS = Array.from({ length: (SEARCH_STEPS * 2 + 1) ** 2 }, (_, index) => ({
  x: ((index % (SEARCH_STEPS * 2 + 1)) - SEARCH_STEPS) * SEARCH_STEP,
  y: (Math.floor(index / (SEARCH_STEPS * 2 + 1)) - SEARCH_STEPS) * SEARCH_STEP,
})).toSorted((first, second) => Math.hypot(first.x, first.y) - Math.hypot(second.x, second.y));

function shifted(box: LabelBox, { x, y }: Point): LabelBox {
  return { bottom: box.bottom + y, left: box.left + x, right: box.right + x, top: box.top + y };
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

  const isFree = (box: LabelBox, lines: readonly LabelSegment[]) =>
    isInside(box, area) &&
    [label.segment, ...lines, ...marks.segments].every(
      (segment) => !touchesSegment(box, segment),
    ) &&
    marks.circles.every((circle) => !touchesCircle(box, circle)) &&
    placed.every((other) => !touchesBox(box, other));

  const shift =
    NEAREST_SHIFTS.find(
      (candidate) =>
        Math.hypot(candidate.x, candidate.y) <= CLEAR_OF_ALL_REACH &&
        isFree(shifted(start, candidate), marks.lines),
    ) ?? NEAREST_SHIFTS.find((candidate) => isFree(shifted(start, candidate), []));

  return shift ? shifted(start, shift) : start;
}

/**
 * Where each line's name sits, in order: by its end of the line on the open side, or at the
 * nearest spot that clears the lines, the marks (drag handles, crossings, arrows) and the names
 * placed before it. When no spot close by clears every line, it keeps off just its own line, so its
 * halo never cuts the line it names.
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
