import { clamp } from "../_utils/snap-value";

export type MapPoint = { x: number; y: number };
export type MapBox = { height: number; width: number; x: number; y: number };

/** The crop keeps between these height-to-width ratios, so it's never a sliver on a phone. */
const MIN_ASPECT = 0.62;
const MAX_ASPECT = 1.05;
/** Room around the places, as a share of their spread, so pins never sit on the edge. */
const SPREAD_PADDING = 0.6;
/** Room around the places, as a share of the map, for a single place or a tight cluster. */
const EDGE_PADDING = 0.06;
const RELAX_ROUNDS = 40;

/** Grows the box to an aspect ratio a screen can show, around its center. */
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

/**
 * The part of a base map to show: every place with room around it, zoomed in no further than
 * the drawing's detail allows, at a shape a phone can show, and never past the map's edges.
 */
export function fitViewport({
  map,
  maxAspect = MAX_ASPECT,
  maxZoom,
  points,
}: {
  map: { height: number; width: number };
  /** The tallest shape the screen has room for, as height over width (never taller than a phone's). */
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

/**
 * Nudges pins that would overlap apart until each has `distance` around it, staying inside the
 * frame. Pins that already have room don't move. Positions come back in the input's order.
 */
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

          /* Pins in the very same spot split along a fixed angle, earlier ones up and left. */
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
