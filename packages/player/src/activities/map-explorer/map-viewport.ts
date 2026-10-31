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
