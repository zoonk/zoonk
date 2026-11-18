import { LABEL_CLEARANCE } from "../_utils/drawing-label";
import { clamp } from "../_utils/snap-value";
import { type MapBox, type MapPoint } from "./map-viewport";

export type MapLabelSpot = {
  positions?: readonly MapPoint[];
  angle: number;
  kind: "region" | "street";
  text: string;
  width: number;
  height: number;
  priority?: boolean;
  question?: boolean;
} & MapPoint;
const LABEL_HALO = 1.5;
export const MAP_PIN_RADIUS = 20;
const HALF_TURN = 180;
const MAP_STREET_SAMPLE_STEP = 4;
const STREET_POSITION_CLEARANCE = 1;
const MAX_STREET_OFFSET = 40;

function axes(label: MapLabelSpot): readonly [MapPoint, MapPoint] {
  const angle = (label.angle * Math.PI) / HALF_TURN;

  return [
    { x: Math.cos(angle), y: Math.sin(angle) },
    { x: -Math.sin(angle), y: Math.cos(angle) },
  ];
}

export function labelProjection(label: MapLabelSpot, axis: MapPoint): number {
  const [along, across] = axes(label);

  return (
    (label.width / 2 + LABEL_HALO) * Math.abs(along.x * axis.x + along.y * axis.y) +
    (label.height / 2 + LABEL_HALO) * Math.abs(across.x * axis.x + across.y * axis.y)
  );
}

function pathDistance(point: MapPoint, path: readonly MapPoint[]): number {
  return Math.min(
    ...path.map((from, index) => {
      const to = path[index + 1] ?? from;
      const dx = to.x - from.x;
      const dy = to.y - from.y;

      const t =
        dx === 0 && dy === 0
          ? 0
          : clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy), 0, 1);

      return Math.hypot(point.x - from.x - t * dx, point.y - from.y - t * dy);
    }),
  );
}

export function besideOwnStreet(
  label: MapLabelSpot,
  streets: readonly (readonly MapPoint[])[],
): boolean {
  if (label.kind !== "street") {
    return true;
  }

  const path = label.positions ?? [];
  const distance = pathDistance(label, path);

  return (
    distance <= MAX_STREET_OFFSET &&
    streets.every(
      (other) =>
        (other.length === path.length &&
          other.every(
            (point, index) => point.x === path[index]?.x && point.y === path[index]?.y,
          )) ||
        distance + label.height / 2 + STREET_POSITION_CLEARANCE <= pathDistance(label, other),
    )
  );
}

export function streetCandidates(
  label: MapLabelSpot,
  inline?: { frame: { width: number; height: number }; boxes: readonly MapBox[] },
): MapPoint[] {
  const [, normal] = axes(label);

  const offset = Math.min(
    MAX_STREET_OFFSET,
    labelProjection(label, normal) + MAP_PIN_RADIUS + LABEL_CLEARANCE,
  );

  const offsets = [
    0,
    -offset,
    offset,
    ...Array.from(
      { length: MAX_STREET_OFFSET / MAP_STREET_SAMPLE_STEP },
      (_, index) => (index + 1) * MAP_STREET_SAMPLE_STEP,
    ).flatMap((across) => [-across, across]),
  ];

  return (label.positions ?? []).flatMap((from, index, path) => {
    const to = path[index + 1] ?? from;

    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / MAP_STREET_SAMPLE_STEP),
    );

    const rx = labelProjection(label, { x: 1, y: 0 });
    const ry = labelProjection(label, { x: 0, y: 1 });

    const xs = inline
      ? [
          rx,
          inline.frame.width - rx,
          ...inline.boxes.flatMap((box) => [
            box.x - rx - LABEL_CLEARANCE,
            box.x + box.width + rx + LABEL_CLEARANCE,
          ]),
        ]
      : [];

    const ys = inline
      ? [
          ry,
          inline.frame.height - ry,
          ...inline.boxes.flatMap((box) => [
            box.y - ry - LABEL_CLEARANCE,
            box.y + box.height + ry + LABEL_CLEARANCE,
          ]),
        ]
      : [];

    const fractions = [
      ...Array.from({ length: steps }, (_, step) => step / steps),
      ...xs.map((x) => (x - from.x) / (to.x - from.x)),
      ...ys.map((y) => (y - from.y) / (to.y - from.y)),
    ].filter((t) => t >= 0 && t <= 1);

    const cuts = fractions.toSorted((a, b) => a - b);

    const candidates = inline
      ? [
          ...cuts,
          ...cuts.slice(1).map((right, cutIndex) => ((cuts[cutIndex] ?? right) + right) / 2),
        ]
      : fractions;

    return candidates
      .map((t) => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }))
      .flatMap((point) =>
        (inline ? [0] : offsets).map((across) => ({
          x: point.x + normal.x * across,
          y: point.y + normal.y * across,
        })),
      );
  });
}
