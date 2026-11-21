import { getLabelWidth } from "./category-labels";
import { LABEL_GAP } from "./chart-layout";

export const DOT_RADIUS = 4.5;
const LABEL_OFFSET = DOT_RADIUS + 3;
const LABEL_HEIGHT = 14;
const LABEL_CLEARANCE = 1;
const MAX_KEY_MARKER_LENGTH = 2;

export type Box = { bottom: number; left: number; right: number; top: number };

export type Pixel = { x: number; y: number };

export type Segment = readonly [Pixel, Pixel];

export type PointLabel = { anchor: "end" | "middle" | "start"; text: string; x: number; y: number };

export type KeyEntry = { label: string; marker: string };

type Named = { dot: Pixel; text: string };

type Scene = { bounds: Box; dots: Pixel[]; segments: Segment[] };

type Candidate = { box: Box; label: PointLabel };

function overlaps(a: Box, b: Box): boolean {
  return (
    a.left < b.right + LABEL_CLEARANCE &&
    b.left < a.right + LABEL_CLEARANCE &&
    a.top < b.bottom + LABEL_CLEARANCE &&
    b.top < a.bottom + LABEL_CLEARANCE
  );
}

function inside(box: Box, bounds: Box): boolean {
  return (
    box.left >= bounds.left &&
    box.right <= bounds.right &&
    box.top >= bounds.top &&
    box.bottom <= bounds.bottom
  );
}

function dotBox({ x, y }: Pixel): Box {
  return {
    bottom: y + DOT_RADIUS,
    left: x - DOT_RADIUS,
    right: x + DOT_RADIUS,
    top: y - DOT_RADIUS,
  };
}

function crosses([from, to]: Segment, box: Box): boolean {
  const low = Math.max(Math.min(from.x, to.x), box.left);
  const high = Math.min(Math.max(from.x, to.x), box.right);

  if (low > high) {
    return false;
  }

  const yAt = (x: number) => from.y + ((x - from.x) / (to.x - from.x)) * (to.y - from.y);
  const ys = to.x === from.x ? [from.y, to.y] : [yAt(low), yAt(high)];

  return Math.max(...ys) >= box.top && Math.min(...ys) <= box.bottom;
}

function boxOf(label: PointLabel): Box {
  const width = getLabelWidth(label.text) - LABEL_GAP;
  const start = { end: label.x - width, middle: label.x - width / 2, start: label.x }[label.anchor];

  return {
    bottom: label.y + LABEL_HEIGHT / 2,
    left: start,
    right: start + width,
    top: label.y - LABEL_HEIGHT / 2,
  };
}

function candidates({ dot, text }: Named): Candidate[] {
  const above = dot.y - LABEL_OFFSET - LABEL_HEIGHT / 2;
  const below = dot.y + LABEL_OFFSET + LABEL_HEIGHT / 2;

  const sides: PointLabel[] = [
    { anchor: "start", text, x: dot.x + LABEL_OFFSET, y: dot.y },
    { anchor: "end", text, x: dot.x - LABEL_OFFSET, y: dot.y },
    { anchor: "middle", text, x: dot.x, y: above },
    { anchor: "middle", text, x: dot.x, y: below },
    { anchor: "start", text, x: dot.x + DOT_RADIUS, y: above },
    { anchor: "end", text, x: dot.x - DOT_RADIUS, y: above },
    { anchor: "start", text, x: dot.x + DOT_RADIUS, y: below },
    { anchor: "end", text, x: dot.x - DOT_RADIUS, y: below },
  ];

  return sides.map((label) => ({ box: boxOf(label), label }));
}

function placeLabels({
  named,
  scene,
}: {
  named: Named[];
  scene: Scene;
}): { label: PointLabel; placed: boolean }[] {
  const taken = scene.dots.map((dot) => dotBox(dot));

  return named.map((item) => {
    const options = candidates(item);

    const free = options
      .filter(
        ({ box }) => inside(box, scene.bounds) && !taken.some((other) => overlaps(box, other)),
      )
      .map((option, order) => ({
        ...option,
        crossings: scene.segments.filter((segment) => crosses(segment, option.box)).length,
        order,
      }))
      .toSorted((a, b) => a.crossings - b.crossings || a.order - b.order);

    const best = free[0] ?? options[0];

    if (best) {
      taken.push(best.box);
    }

    return {
      label: best?.label ?? { anchor: "start", text: item.text, x: item.dot.x, y: item.dot.y },
      placed: free.length > 0,
    };
  });
}

/**
 * Every labeled point keeps its name. When one can't sit beside its dot without covering another,
 * every name moves to a numbered key, except names as short as a number, which gain nothing from it.
 */
export function getPointLabels({ named, scene }: { named: Named[]; scene: Scene }): {
  key: KeyEntry[];
  labels: PointLabel[];
} {
  const direct = placeLabels({ named, scene });
  const short = named.every(({ text }) => text.length <= MAX_KEY_MARKER_LENGTH);

  if (short || direct.every(({ placed }) => placed)) {
    return { key: [], labels: direct.map(({ label }) => label) };
  }

  const key = named.map(({ text }, index) => ({ label: text, marker: String(index + 1) }));
  const markers = named.map(({ dot }, index) => ({ dot, text: key[index]?.marker ?? "" }));

  return { key, labels: placeLabels({ named: markers, scene }).map(({ label }) => label) };
}
