import {
  LABEL_CLEARANCE as CLEARANCE,
  type LabelBox,
  type LabelSegment,
  closestPoint,
  isOnNamedSide,
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
  const columns = Math.floor((area.right - area.left - width) / spacing) + 1;
  const rows = Math.floor((area.bottom - area.top - height) / spacing) + 1;

  if (columns < 1 || rows < 1) {
    return [];
  }

  return Array.from({ length: columns * rows }, (_, index) => {
    const left = area.left + (index % columns) * spacing;
    const top = area.top + Math.floor(index / columns) * spacing;
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

function pointGap(point: Point, box: LabelBox): number {
  return Math.hypot(
    Math.max(box.left - point.x, 0, point.x - box.right),
    Math.max(box.top - point.y, 0, point.y - box.bottom),
  );
}

function segmentGap(box: LabelBox, segment: LabelSegment): number {
  if (touchesSegment(box, segment, 0)) {
    return 0;
  }

  const corners = [box.left, box.right].flatMap((x) =>
    [box.top, box.bottom].map((y) => ({ x, y })),
  );

  return Math.min(
    pointGap(segment.from, box),
    pointGap(segment.to, box),
    ...corners.map((corner) => {
      const nearest = closestPoint(corner, segment);
      return Math.hypot(corner.x - nearest.x, corner.y - nearest.y);
    }),
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

  const clearsMarks = (box: LabelBox) =>
    marks.circles.every((circle) => !touchesCircle(box, circle)) &&
    placed.every((other) => !touchesBox(box, other));

  const isNearestItsLine = (box: LabelBox) => {
    const own = segmentGap(box, label.segment);

    return marks.lines.every(
      (segment) => segment === label.segment || own < segmentGap(box, segment),
    );
  };

  const fits = (box: LabelBox, lines: readonly LabelSegment[]) =>
    isInside(box, area) &&
    !touchesSegment(box, label.segment) &&
    requiredLines.every((line) => !touchesSegment(box, line)) &&
    lines.every((line) => !touchesSegment(box, line)) &&
    marks.boxes.every((other) => !touchesBox(box, other));

  const clearsAll = (box: LabelBox) => fits(box, marks.lines) && clearsMarks(box);
  const offItsLine = (box: LabelBox) => fits(box, []) && isNearestItsLine(box);
  const isClear = (box: LabelBox) => offItsLine(box) && clearsMarks(box);

  const nearby = (accepts: (box: LabelBox, shift: Point) => boolean) => {
    const shift = NEAREST_SHIFTS.find((candidate) =>
      accepts(shifted(start, candidate, step), candidate),
    );

    return shift && shifted(start, shift, step);
  };

  const spots = spotsAcross(area, start);

  const clear =
    nearby(
      (box, shift) =>
        (origin !== undefined || Math.hypot(shift.x, shift.y) <= CLEAR_OF_ALL_STEPS) &&
        clearsAll(box) &&
        isNearestItsLine(box),
    ) ??
    nearby(isClear) ??
    spots.find((box) => isClear(box));

  if (clear || label.isOptional) {
    return clear ?? null;
  }

  if (origin) {
    const candidates = spotsAcross(area, start, step).filter((box) => clearsAll(box));
    const strict = candidates.find((box) => isNearestItsLine(box));

    if (strict) {
      return strict;
    }

    const closest = candidates.reduce<{ box: LabelBox; gap: number } | null>((best, box) => {
      if (!requiredLines.every((line) => isOnNamedSide(box, label.segment, line))) {
        return best;
      }

      const gap = segmentGap(box, label.segment);
      return !best || gap < best.gap ? { box, gap } : best;
    }, null);

    if (closest) {
      return closest.box;
    }
  }

  const clearsRequired = (box: LabelBox) =>
    isInside(box, area) && requiredLines.every((line) => !touchesSegment(box, line));

  return (
    nearby(clearsAll) ??
    spots.find((box) => clearsAll(box)) ??
    nearby(offItsLine) ??
    spots.find((box) => offItsLine(box)) ??
    (requiredLines.length > 0
      ? (nearby(clearsRequired) ?? spots.find((box) => clearsRequired(box)) ?? null)
      : start)
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
    lines: [...shown.map((label) => label.segment), ...marks.lines],
  };

  const before = placeLineLabels({ area, labels: shown, marks: visibleMarks });
  const unmeasured = revealedLine && revealed.length === 0 ? [revealedLine] : [];
  const answerLines = [...revealed.map((label) => label.segment), ...unmeasured];

  if (answerLines.length === 0) {
    return before;
  }

  const checkedMarks = { ...marks, lines: [...visibleMarks.lines, ...answerLines] };

  const crosses = (box: LabelBox | null) =>
    box !== null && answerLines.some((line) => touchesSegment(box, line));

  const kept = before.map((box) => (crosses(box) ? null : box));

  const placed = shown.reduce((positions, label, index) => {
    const origin = before[index];

    if (!origin || !crosses(origin)) {
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
