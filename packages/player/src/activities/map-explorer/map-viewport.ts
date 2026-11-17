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

export type MapLabelSpot = {
  positions?: readonly MapPoint[];
  angle: number;
  kind: "region" | "street";
  text: string;
  width: number;
  height: number;
  priority?: boolean;
} & MapPoint;
const LABEL_CLEARANCE = 3;
const LABEL_HALO = 1.5;
const PIN_RADIUS = 20;
const HALF_TURN = 180;

function axes(label: MapLabelSpot): readonly [MapPoint, MapPoint] {
  const angle = (label.angle * Math.PI) / HALF_TURN;

  return [
    { x: Math.cos(angle), y: Math.sin(angle) },
    { x: -Math.sin(angle), y: Math.cos(angle) },
  ];
}

function projection(label: MapLabelSpot, axis: MapPoint): number {
  const [along, across] = axes(label);

  return (
    (label.width / 2 + LABEL_HALO) * Math.abs(along.x * axis.x + along.y * axis.y) +
    (label.height / 2 + LABEL_HALO) * Math.abs(across.x * axis.x + across.y * axis.y)
  );
}

function clearOfLabel(label: MapLabelSpot, other: MapLabelSpot): boolean {
  return [...axes(label), ...axes(other)].some(
    (axis) =>
      Math.abs((label.x - other.x) * axis.x + (label.y - other.y) * axis.y) >=
      projection(label, axis) + projection(other, axis) + LABEL_CLEARANCE,
  );
}

function clearOfPin(label: MapLabelSpot, pin: MapPoint): boolean {
  const [along, across] = axes(label);
  const dx = pin.x - label.x;
  const dy = pin.y - label.y;

  return (
    Math.hypot(
      Math.max(Math.abs(dx * along.x + dy * along.y) - label.width / 2 - LABEL_HALO, 0),
      Math.max(Math.abs(dx * across.x + dy * across.y) - label.height / 2 - LABEL_HALO, 0),
    ) >=
    PIN_RADIUS + LABEL_CLEARANCE
  );
}
export function placeMapLabels({
  frame,
  labels,
  pins,
}: {
  frame: { height: number; width: number };
  labels: readonly MapLabelSpot[];
  pins: readonly MapPoint[];
}): (MapPoint | null)[] {
  const placed: MapLabelSpot[] = [];
  const spots: (MapPoint | null)[] = labels.map(() => null);

  const order = labels
    .map((label, index) => ({ index, label }))
    .toSorted((a, b) => Number(Boolean(b.label.priority)) - Number(Boolean(a.label.priority)));

  for (const { index, label } of order) {
    const candidates = label.kind === "street" ? (label.positions ?? []) : [label];

    const spot = candidates
      .toSorted(
        (a, b) =>
          Math.hypot(a.x - label.x, a.y - label.y) - Math.hypot(b.x - label.x, b.y - label.y),
      )
      .map((point) => ({ ...label, ...point }))
      .find((candidate) => {
        const rx = projection(candidate, { x: 1, y: 0 });
        const ry = projection(candidate, { x: 0, y: 1 });

        return (
          candidate.x >= rx &&
          candidate.x + rx <= frame.width &&
          candidate.y >= ry &&
          candidate.y + ry <= frame.height &&
          pins.every((pin) => clearOfPin(candidate, pin)) &&
          placed.every((other) => clearOfLabel(candidate, other))
        );
      });

    if (spot) {
      placed.push(spot);
      spots[index] = { x: spot.x, y: spot.y };
    }
  }

  return spots;
}

type MapRegion = { id: string; name: string; tone: string };

const UNTINTED_TONES = new Set(["context", "focus"]);

/**
 * The tinted regions to leave off the map: one whose name was left out and whose tint the legend
 * doesn't explain would read as a stray shape.
 */
export function strayRegions({
  labels,
  legendTones,
  regions,
  spots,
}: {
  labels: readonly { kind: "region" | "street"; text: string }[];
  legendTones: readonly string[];
  regions: readonly MapRegion[];
  spots: readonly (MapPoint | null)[];
}): string[] {
  const unnamed = new Set(
    labels.flatMap((label, index) =>
      label.kind === "region" && spots[index] === null ? [label.text] : [],
    ),
  );

  return regions
    .filter(
      (region) =>
        !UNTINTED_TONES.has(region.tone) &&
        !legendTones.includes(region.tone) &&
        unnamed.has(region.name),
    )
    .map((region) => region.id);
}
