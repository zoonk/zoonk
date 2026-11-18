import {
  LABEL_CLEARANCE as CLEARANCE,
  type LabelBox,
  type LabelSegment,
  edgeSpots,
  isOnNamedSide,
  segmentGapSquared,
  separatesName,
  touchesSegment,
} from "../_utils/drawing-label";
import { clamp } from "../_utils/snap-value";
import { type Point } from "./line-crossing-model";

export { type LabelBox } from "../_utils/drawing-label";

type LabelCircle = { cx: number; cy: number; radius: number };
export type LabelSize = { height: number; width: number };
type LineLabel = { isOptional?: boolean; isUpper: boolean; segment: LabelSegment; size: LabelSize };

export const ARROW_STROKE = 2;
export const ARROW_HEAD = 7;

const ARROW_HEAD_REACH = (ARROW_HEAD * ARROW_STROKE) / 2;
const ARROW_AXIS_GAP = 8;
const ARROW_OFFSET = ARROW_HEAD_REACH + ARROW_AXIS_GAP;
const ARROW_INSET = 3;
const ARROW_SHAFT = 4;

const LABEL_GAP = 8;
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

function spotsAcross(area: LabelBox, start: LabelBox, step?: number): LabelBox[] {
  const [width, height] = [start.right - start.left, start.bottom - start.top];
  const spacing = step ?? height;
  const spanX = area.right - area.left - width;
  const spanY = area.bottom - area.top - height;
  const columns = Math.ceil(spanX / spacing) + 1;
  const rows = Math.ceil(spanY / spacing) + 1;

  if (spanX < 0 || spanY < 0) {
    return [];
  }

  return Array.from({ length: columns * rows }, (_, index) => {
    const left = area.left + Math.min(spanX, (index % columns) * spacing);
    const top = area.top + Math.min(spanY, Math.floor(index / columns) * spacing);
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

function belongsWith(box: LabelBox, named: LabelSegment, lines: readonly LabelSegment[]): boolean {
  const own = segmentGapSquared(box, named);

  return lines.every(
    (line) =>
      line === named || (own < segmentGapSquared(box, line) && !separatesName(box, named, line)),
  );
}

function closestOnNamedSide(
  candidates: readonly LabelBox[],
  named: LabelSegment,
  answers: readonly LabelSegment[],
  avoidsMarks: (box: LabelBox) => boolean,
): LabelBox | null {
  const sameSide = candidates.filter((box) =>
    answers.every((line) => isOnNamedSide(box, named, line)),
  );

  const open = sameSide.filter((box) => avoidsMarks(box));

  return (open.length > 0 ? open : sameSide).reduce<LabelBox | null>(
    (best, box) =>
      !best || segmentGapSquared(box, named) < segmentGapSquared(best, named) ? box : best,
    null,
  );
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

/** Every name starts at its line's upper end, where the lines' names sit: over its line, or under it for a dashed copy. */
function besideEnd({ isUpper, segment, size }: LineLabel, area: LabelBox): LabelBox {
  const end = segment.from.y > segment.to.y ? segment.to : segment.from;

  const left =
    end.x < (area.left + area.right) / 2 ? end.x + LABEL_GAP : end.x - LABEL_GAP - size.width;

  const top = isUpper ? end.y - LABEL_GAP - size.height : end.y + LABEL_GAP;

  return { bottom: top + size.height, left, right: left + size.width, top };
}

type ArrowEnds = { after: Point; before: Point; bottom: number; left: number };

/**
 * The arrows that show how far the crossing moved along each axis, in pixels: between the two
 * guides, without touching them, and clear of the axis. One too short to show more than its head
 * is left out; the summary under the chart still says it.
 */
export function changeArrows({ after, before, bottom, left }: ArrowEnds): LabelSegment[] {
  const arrows = [
    { from: { x: left + ARROW_OFFSET, y: before.y }, to: { x: left + ARROW_OFFSET, y: after.y } },
    {
      from: { x: before.x, y: bottom - ARROW_OFFSET },
      to: { x: after.x, y: bottom - ARROW_OFFSET },
    },
  ];

  return arrows.flatMap(({ from, to }) => {
    const length = Math.hypot(to.x - from.x, to.y - from.y);

    if (length - ARROW_INSET * 2 < ARROW_HEAD_REACH * 2 + ARROW_SHAFT) {
      return [];
    }

    const [ux, uy] = [(to.x - from.x) / length, (to.y - from.y) / length];

    return [
      {
        from: { x: from.x + ux * ARROW_INSET, y: from.y + uy * ARROW_INSET },
        to: { x: to.x - ux * ARROW_INSET, y: to.y - uy * ARROW_INSET },
      },
    ];
  });
}

export function changeArrowBoxes(ends: ArrowEnds): LabelBox[] {
  return changeArrows(ends).map(({ from, to }) => ({
    bottom: Math.max(from.y, to.y) + ARROW_HEAD_REACH,
    left: Math.min(from.x, to.x) - ARROW_HEAD_REACH,
    right: Math.max(from.x, to.x) + ARROW_HEAD_REACH,
    top: Math.min(from.y, to.y) - ARROW_HEAD_REACH,
  }));
}

type LabelMarks = {
  boxes: readonly LabelBox[];
  circles: readonly LabelCircle[];
  guides?: readonly LabelSegment[];
  lines: readonly LabelSegment[];
};

function placeLineLabel({
  area,
  label,
  marks,
  placed,
  origin,
  requiredLines = [],
}: {
  area: LabelBox;
  label: LineLabel;
  marks: LabelMarks;
  placed: readonly LabelBox[];
  origin?: LabelBox;
  requiredLines?: readonly LabelSegment[];
}): LabelBox | null {
  const start = origin ?? besideEnd(label, area);
  const step = label.size.height / STEPS_PER_LABEL_HEIGHT;

  const avoidsBoxes = (box: LabelBox) => marks.boxes.every((other) => !touchesBox(box, other));

  const avoidsMarks = (box: LabelBox) =>
    avoidsBoxes(box) &&
    marks.circles.every((circle) => !touchesCircle(box, circle)) &&
    placed.every((other) => !touchesBox(box, other));

  const clearsAnswer = (box: LabelBox) =>
    isInside(box, area) && requiredLines.every((line) => !touchesSegment(box, line));

  const belongs = (box: LabelBox) => belongsWith(box, label.segment, marks.lines);
  const guides = marks.guides ?? [];
  const strokes = [label.segment, ...marks.lines, ...guides];
  const clearsStrokes = (box: LabelBox) => strokes.every((line) => !touchesSegment(box, line));
  const fits = (box: LabelBox) => clearsAnswer(box) && belongs(box);

  const nearby = (accepts: (box: LabelBox, shift: Point) => boolean) => {
    const shift = NEAREST_SHIFTS.find((candidate) =>
      accepts(shifted(start, candidate, step), candidate),
    );

    return shift && shifted(start, shift, step);
  };

  const clear = nearby(
    (box, shift) =>
      (origin !== undefined || Math.hypot(shift.x, shift.y) <= CLEAR_OF_ALL_STEPS) &&
      clearsStrokes(box) &&
      avoidsMarks(box) &&
      fits(box) &&
      guides.every((line) => segmentGapSquared(box, label.segment) < segmentGapSquared(box, line)),
  );

  const associated = (box: LabelBox) =>
    avoidsMarks(box) && !touchesSegment(box, label.segment) && fits(box);

  const close =
    clear ?? nearby(associated) ?? spotsAcross(area, start).find((box) => associated(box));

  if (close) {
    return close;
  }

  const candidates = spotsAcross(area, start, Math.min(1, step)).filter((box) => clearsAnswer(box));
  const named = candidates.filter((box) => belongs(box));
  const offLine = named.find((box) => avoidsMarks(box) && !touchesSegment(box, label.segment, 0));

  if (label.isOptional) {
    return offLine ?? null;
  }

  const owned =
    offLine ??
    named.find((box) => !touchesSegment(box, label.segment) && avoidsBoxes(box)) ??
    named.find((box) => avoidsMarks(box)) ??
    named[0] ??
    edgeSpots(area, label.size).find((box) => fits(box));

  if (owned) {
    return owned;
  }

  if (requiredLines.length === 0) {
    return belongs(start) ? start : null;
  }

  return (
    closestOnNamedSide(candidates, label.segment, requiredLines, avoidsMarks) ??
    candidates.find((box) => clearsStrokes(box) && avoidsMarks(box)) ??
    candidates[0] ??
    null
  );
}

export function placeLineLabels({
  area,
  labels,
  marks,
  placed = [],
  requiredLines = [],
}: {
  area: LabelBox;
  labels: readonly LineLabel[];
  marks: LabelMarks;
  placed?: readonly LabelBox[];
  requiredLines?: readonly LabelSegment[];
}): (LabelBox | null)[] {
  const [label, ...rest] = labels;

  if (!label) {
    return [];
  }

  const box = placeLineLabel({ area, label, marks, placed, requiredLines });
  const next = box ? [...placed, box] : placed;
  return [box, ...placeLineLabels({ area, labels: rest, marks, placed: next, requiredLines })];
}

export function placeChartLabels({
  area,
  marks,
  revealed,
  revealedLine,
  shown,
}: {
  area: LabelBox;
  marks: LabelMarks;
  revealed: readonly LineLabel[];
  revealedLine?: LabelSegment;
  shown: readonly LineLabel[];
}): (LabelBox | null)[] {
  const visibleMarks = {
    ...marks,
    guides: marks.lines,
    lines: shown.map((label) => label.segment),
  };

  const before = placeLineLabels({ area, labels: shown, marks: visibleMarks });
  const unmeasured = revealedLine && revealed.length === 0 ? [revealedLine] : [];
  const answerLines = [...revealed.map((label) => label.segment), ...unmeasured];

  if (answerLines.length === 0) {
    return before;
  }

  const checkedMarks = { ...visibleMarks, lines: [...visibleMarks.lines, ...answerLines] };

  const needsPlacement = (box: LabelBox, line: LabelSegment) =>
    answerLines.some((answer) => touchesSegment(box, answer)) ||
    !belongsWith(box, line, answerLines);

  const kept = before.map((box, index) => {
    const label = shown[index];
    return box && label && needsPlacement(box, label.segment) ? null : box;
  });

  const placed = shown.reduce((positions, label, index) => {
    const origin = before[index];

    if (!origin || kept[index]) {
      return positions;
    }

    const relocated = placeLineLabel({
      area,
      label: { ...label, isOptional: false },
      marks: checkedMarks,
      origin,
      placed: positions.filter((box) => box !== null),
      requiredLines: answerLines,
    });

    return positions.with(index, relocated);
  }, kept);

  return [
    ...placed,
    ...placeLineLabels({
      area,
      labels: revealed,
      marks: checkedMarks,
      placed: placed.filter((box) => box !== null),
      requiredLines: answerLines,
    }),
  ];
}
