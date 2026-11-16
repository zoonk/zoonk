import {
  LABEL_CLEARANCE as CLEARANCE,
  type LabelBox,
  type LabelSegment,
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

function pointGap(point: Point, box: LabelBox): number {
  return Math.hypot(
    Math.max(box.left - point.x, 0, point.x - box.right),
    Math.max(box.top - point.y, 0, point.y - box.bottom),
  );
}

function segmentPointGap(point: Point, { from, to }: LabelSegment): number {
  const [dx, dy] = [to.x - from.x, to.y - from.y];

  const along =
    dx === 0 && dy === 0
      ? 0
      : ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx ** 2 + dy ** 2);

  const t = clamp(along, 0, 1);
  return Math.hypot(point.x - (from.x + t * dx), point.y - (from.y + t * dy));
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
    ...corners.map((corner) => segmentPointGap(corner, segment)),
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
}: {
  area: LabelBox;
  label: LineLabel;
  marks: LabelMarks;
  placed: readonly LabelBox[];
}): LabelBox | null {
  const start = besideEnd(label, area);
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
    [label.segment, ...lines].every((segment) => !touchesSegment(box, segment)) &&
    marks.boxes.every((other) => !touchesBox(box, other)) &&
    isNearestItsLine(box);

  const isClear = (box: LabelBox) => fits(box, []) && clearsMarks(box);
  const offItsLine = (box: LabelBox) => fits(box, []);

  const nearby = (passes: readonly ((box: LabelBox, shift: Point) => boolean)[]) => {
    const shift = passes.reduce<Point | null>(
      (found, pass) =>
        found ??
        NEAREST_SHIFTS.find((candidate) => pass(shifted(start, candidate, step), candidate)) ??
        null,
      null,
    );

    return shift && shifted(start, shift, step);
  };

  const spots = spotsAcross(area, start);

  const clear =
    nearby([
      (box, shift) =>
        Math.hypot(shift.x, shift.y) <= CLEAR_OF_ALL_STEPS &&
        fits(box, marks.lines) &&
        clearsMarks(box),
      isClear,
    ]) ?? spots.find((box) => isClear(box));

  if (clear || label.isOptional) {
    return clear ?? null;
  }

  return nearby([offItsLine]) ?? spots.find((box) => offItsLine(box)) ?? start;
}

/**
 * Where each line's name sits, in order: by its line's upper end (over the line, or under it for a
 * dashed copy), or at the nearest spot that clears the lines, the marks (drag handles, crossings)
 * and the names placed before it. Every spot is nearer its own line than any other, so a name never
 * reads as another line's. When no spot close by clears every line, it keeps off its own line and
 * the marks, searching the whole chart before it gives up the marks, so a name never sits under a
 * handle while a free spot is left; then it keeps just off its own line. Every spot it searches keeps clear of the boxes (the arrows, heads included, and the axis title). Its
 * halo never cuts the line it names: with no free spot anywhere it stays by its end. An optional
 * name with no spot clear of the marks and the names before it is left out, as null.
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
}): (LabelBox | null)[] {
  const [label, ...rest] = labels;

  if (!label) {
    return [];
  }

  const box = placeLineLabel({ area, label, marks, placed });
  const next = box ? [...placed, box] : placed;
  return [box, ...placeLineLabels({ area, labels: rest, marks, placed: next })];
}

/**
 * Every name on the chart. The names shown while answering are placed against their own lines
 * only, so the answer's line and name that Check reveals never move them; the answer's name then
 * takes a spot around them, against every line.
 */
export function placeChartLabels({
  area,
  marks,
  revealed,
  shown,
}: {
  area: LabelBox;
  marks: Omit<LabelMarks, "lines">;
  revealed: readonly LineLabel[];
  shown: readonly LineLabel[];
}): (LabelBox | null)[] {
  const segments = (labels: readonly LineLabel[]) => labels.map((label) => label.segment);

  const placed = placeLineLabels({
    area,
    labels: shown,
    marks: { ...marks, lines: segments(shown) },
  });

  return [
    ...placed,
    ...placeLineLabels({
      area,
      labels: revealed,
      marks: { ...marks, lines: segments([...shown, ...revealed]) },
      placed: placed.filter((box) => box !== null),
    }),
  ];
}
