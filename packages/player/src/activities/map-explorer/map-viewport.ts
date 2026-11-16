import { estimatedLabelWidth } from "../_utils/drawing-label";
import { clamp } from "../_utils/snap-value";

export type MapPoint = { x: number; y: number };
export type MapBox = { height: number; width: number; x: number; y: number };

const MIN_ASPECT = 0.62;
const MAX_ASPECT = 1.05;
const SPREAD_PADDING = 0.6;
const EDGE_PADDING = 0.06;
const RELAX_ROUNDS = 40;

function withAspect(
  box: { height: number; width: number },
  maxAspect: number,
): { height: number; width: number } {
  const aspect = box.height / box.width;
  const minAspect = Math.min(MIN_ASPECT, maxAspect);

  if (aspect > maxAspect) {
    return { height: box.height, width: box.height / maxAspect };
  }

  return aspect < minAspect ? { height: box.width * minAspect, width: box.width } : box;
}

export function fitViewport({
  map,
  maxAspect = MAX_ASPECT,
  maxZoom,
  points,
}: {
  map: { height: number; width: number };
  maxAspect?: number;
  maxZoom: number;
  points: readonly MapPoint[];
}): MapBox {
  if (points.length === 0) {
    return { height: map.height, width: map.width, x: 0, y: 0 };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  const [left, right, top, bottom] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];

  const edge = Math.max(map.width, map.height) * EDGE_PADDING;

  const wanted = withAspect(
    {
      height: Math.max((bottom - top) * (1 + SPREAD_PADDING) + edge * 2, map.height / maxZoom),
      width: Math.max((right - left) * (1 + SPREAD_PADDING) + edge * 2, map.width / maxZoom),
    },
    Math.min(maxAspect, MAX_ASPECT),
  );

  const [width, height] = [Math.min(wanted.width, map.width), Math.min(wanted.height, map.height)];
  const [centerX, centerY] = [(left + right) / 2, (top + bottom) / 2];

  return {
    height,
    width,
    x: clamp(centerX - width / 2, 0, map.width - width),
    y: clamp(centerY - height / 2, 0, map.height - height),
  };
}

export function spreadPins({
  distance,
  frame,
  points,
}: {
  distance: number;
  frame: { height: number; width: number };
  points: readonly MapPoint[];
}): MapPoint[] {
  const inset = distance / 2;

  const relax = (current: MapPoint[]): MapPoint[] =>
    current.map((point, index) => {
      const push = current.reduce(
        (total, other, otherIndex) => {
          const [dx, dy] = [point.x - other.x, point.y - other.y];
          const gap = Math.hypot(dx, dy);

          if (otherIndex === index || gap >= distance) {
            return total;
          }

          const [ux, uy] = gap === 0 ? [otherIndex < index ? 1 : -1, 0] : [dx / gap, dy / gap];
          const overlap = (distance - gap) / 2;
          return { x: total.x + ux * overlap, y: total.y + uy * overlap };
        },
        { x: 0, y: 0 },
      );

      return {
        x: clamp(point.x + push.x, inset, frame.width - inset),
        y: clamp(point.y + push.y, inset, frame.height - inset),
      };
    });

  return Array.from({ length: RELAX_ROUNDS }).reduce<MapPoint[]>(
    (current) => relax(current),
    [...points],
  );
}

export type MapLabelSpot = { angle: number; kind: "region" | "street"; text: string } & MapPoint;

const LABEL_HEIGHT = 12;
const LABEL_REACH = LABEL_HEIGHT / 2;
const LABEL_CLEARANCE = 3;
const PIN_RADIUS = 20;
const SLIDE_STEP = 4;
const HALF_TURN = 180;

/** The name's ink as a row of circles along its baseline, which a rotated name's box can't follow. */
function labelInk(label: MapLabelSpot, at: MapPoint): MapPoint[] {
  const reach = Math.max(estimatedLabelWidth(label.text) / 2 - LABEL_REACH, 0);
  const radians = (label.angle * Math.PI) / HALF_TURN;
  const count = Math.ceil((reach * 2) / LABEL_REACH);

  return Array.from({ length: count + 1 }, (_, index) => {
    const along = count === 0 ? 0 : -reach + (reach * 2 * index) / count;
    return { x: at.x + Math.cos(radians) * along, y: at.y + Math.sin(radians) * along };
  });
}

function slides(label: MapLabelSpot): number[] {
  const most = label.kind === "street" ? estimatedLabelWidth(label.text) : 0;
  const steps = Math.floor(most / SLIDE_STEP);

  return [
    0,
    ...Array.from({ length: steps }, (_, index) => [
      (index + 1) * SLIDE_STEP,
      -(index + 1) * SLIDE_STEP,
    ]).flat(),
  ];
}

/**
 * Where each of the map's names is drawn, in frame pixels: at its own spot when the map's edges,
 * the pins and the names before it leave that clear; a street's name otherwise slides along its
 * street to the nearest clear spot, within its own length. A name with no clear spot is left out,
 * as null, rather than drawn cut or covered.
 */
export function placeMapLabels({
  frame,
  labels,
  pins,
}: {
  frame: { height: number; width: number };
  labels: readonly MapLabelSpot[];
  pins: readonly MapPoint[];
}): (MapPoint | null)[] {
  const isClear = (ink: readonly MapPoint[], placed: readonly MapPoint[]) =>
    ink.every(
      (point) =>
        point.x - LABEL_REACH >= 0 &&
        point.x + LABEL_REACH <= frame.width &&
        point.y - LABEL_REACH >= 0 &&
        point.y + LABEL_REACH <= frame.height &&
        pins.every(
          (pin) =>
            Math.hypot(point.x - pin.x, point.y - pin.y) >=
            LABEL_REACH + PIN_RADIUS + LABEL_CLEARANCE,
        ) &&
        placed.every(
          (other) =>
            Math.hypot(point.x - other.x, point.y - other.y) >= LABEL_HEIGHT + LABEL_CLEARANCE,
        ),
    );

  return labels.reduce<{ placed: MapPoint[]; spots: (MapPoint | null)[] }>(
    ({ placed, spots }, label) => {
      const radians = (label.angle * Math.PI) / HALF_TURN;

      const spot =
        slides(label)
          .map((slide) => ({
            x: label.x + Math.cos(radians) * slide,
            y: label.y + Math.sin(radians) * slide,
          }))
          .find((at) => isClear(labelInk(label, at), placed)) ?? null;

      return {
        placed: spot ? [...placed, ...labelInk(label, spot)] : placed,
        spots: [...spots, spot],
      };
    },
    { placed: [], spots: [] },
  ).spots;
}
