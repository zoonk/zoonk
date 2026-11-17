import { clamp } from "../_utils/snap-value";
import { type MapPoint } from "./map-viewport";

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
  return (
    Math.abs(label.x - other.x) >=
      projection(label, { x: 1, y: 0 }) + projection(other, { x: 1, y: 0 }) + LABEL_CLEARANCE ||
    Math.abs(label.y - other.y) >=
      projection(label, { x: 0, y: 1 }) + projection(other, { x: 0, y: 1 }) + LABEL_CLEARANCE
  );
}

function clearOfPin(label: MapLabelSpot, pin: MapPoint): boolean {
  return (
    Math.abs(label.x - pin.x) >= projection(label, { x: 1, y: 0 }) + PIN_RADIUS + LABEL_CLEARANCE ||
    Math.abs(label.y - pin.y) >= projection(label, { x: 0, y: 1 }) + PIN_RADIUS + LABEL_CLEARANCE
  );
}

function inFrame(label: MapLabelSpot, frame: { height: number; width: number }): boolean {
  const rx = projection(label, { x: 1, y: 0 });
  const ry = projection(label, { x: 0, y: 1 });

  return (
    label.x >= rx && label.x + rx <= frame.width && label.y >= ry && label.y + ry <= frame.height
  );
}

export type MapLabelPlacement = MapPoint & { scale?: number };
const MIN_LABEL_SCALE = 0.8;
const LABEL_SCALES = [1, (1 + MIN_LABEL_SCALE) / 2, MIN_LABEL_SCALE] as const;

function namedCandidates(
  label: MapLabelSpot,
  placed: readonly MapLabelSpot[],
  pins: readonly MapPoint[],
  frame: { width: number; height: number },
): MapPoint[] {
  const rx = projection(label, { x: 1, y: 0 });
  const ry = projection(label, { x: 0, y: 1 });

  if (rx * 2 > frame.width || ry * 2 > frame.height) {
    return [];
  }

  const seeds = [...(label.positions ?? []), label];

  const obstacles = [
    ...placed.map((other) => ({
      rx: projection(other, { x: 1, y: 0 }),
      ry: projection(other, { x: 0, y: 1 }),
      x: other.x,
      y: other.y,
    })),
    ...pins.map((pin) => ({ ...pin, rx: PIN_RADIUS, ry: PIN_RADIUS })),
  ];

  const xs = [
    rx,
    frame.width - rx,
    ...seeds.map((point) => point.x),
    ...obstacles.flatMap((other) => [
      other.x - rx - other.rx - LABEL_CLEARANCE,
      other.x + rx + other.rx + LABEL_CLEARANCE,
    ]),
  ].map((value) => clamp(value, rx, frame.width - rx));

  const ys = [
    ry,
    frame.height - ry,
    ...seeds.map((point) => point.y),
    ...obstacles.flatMap((other) => [
      other.y - ry - other.ry - LABEL_CLEARANCE,
      other.y + ry + other.ry + LABEL_CLEARANCE,
    ]),
  ].map((value) => clamp(value, ry, frame.height - ry));

  return [...new Set(xs)].flatMap((x) => [...new Set(ys)].map((y) => ({ x, y })));
}

export function isMapLabelNamed({
  references,
  source,
  text,
}: {
  references: string;
  source: string;
  text: string;
}): boolean {
  const named = references.toLowerCase();
  return [source, text].some((value) => value.length > 0 && named.includes(value.toLowerCase()));
}

export function placeMapLabels({
  frame,
  labels,
  pins,
}: {
  frame: { height: number; width: number };
  labels: readonly MapLabelSpot[];
  pins: readonly MapPoint[];
}): (MapLabelPlacement | null)[] {
  const order = labels
    .map((label, index) => ({ index, label }))
    .toSorted(
      (a, b) =>
        Number(Boolean(b.label.question)) - Number(Boolean(a.label.question)) ||
        Number(Boolean(b.label.priority)) - Number(Boolean(a.label.priority)),
    );

  const named = order.filter(({ label }) => label.priority || label.question);

  function arrange(scale: number, pack: boolean) {
    const placed: MapLabelSpot[] = [];
    const spots: (MapLabelPlacement | null)[] = labels.map(() => null);

    for (const { index, label: original } of named) {
      const label = { ...original, height: original.height * scale, width: original.width * scale };

      const points = namedCandidates(label, placed, pins, frame).toSorted((a, b) =>
        pack
          ? a.y - b.y || a.x - b.x
          : Math.hypot(a.x - label.x, a.y - label.y) - Math.hypot(b.x - label.x, b.y - label.y),
      );

      const originalPoints = (label.kind === "street" ? (label.positions ?? []) : [label]).toSorted(
        (a, b) =>
          Math.hypot(a.x - label.x, a.y - label.y) - Math.hypot(b.x - label.x, b.y - label.y),
      );

      const spot = (pack ? points : [...originalPoints, ...points])
        .map((point) => ({ ...label, ...point }))
        .find(
          (candidate) =>
            inFrame(candidate, frame) &&
            pins.every((pin) => clearOfPin(candidate, pin)) &&
            placed.every((other) => clearOfLabel(candidate, other)),
        );

      if (spot) {
        placed.push(spot);
        spots[index] = { x: spot.x, y: spot.y, ...(scale < 1 ? { scale } : {}) };
      }
    }

    return { placed, spots };
  }

  let chosen = arrange(1, false);

  const questions = (layout: typeof chosen) =>
    named.filter((item) => item.label.question && layout.spots[item.index]).length;

  for (const scale of LABEL_SCALES) {
    for (const pack of [false, true]) {
      const layout = arrange(scale, pack);

      if (
        questions(layout) > questions(chosen) ||
        (questions(layout) === questions(chosen) && layout.placed.length > chosen.placed.length)
      ) {
        chosen = layout;
      }

      if (layout.placed.length === named.length) {
        chosen = layout;
        break;
      }
    }

    if (chosen.placed.length === named.length) {
      break;
    }
  }

  for (const { index, label } of order.filter(
    ({ label: item }) => !item.priority && !item.question,
  )) {
    const spot = (label.kind === "street" ? (label.positions ?? []) : [label])
      .toSorted(
        (a, b) =>
          Math.hypot(a.x - label.x, a.y - label.y) - Math.hypot(b.x - label.x, b.y - label.y),
      )
      .map((point) => ({ ...label, ...point }))
      .find(
        (candidate) =>
          inFrame(candidate, frame) &&
          pins.every((pin) => clearOfPin(candidate, pin)) &&
          chosen.placed.every((other) => clearOfLabel(candidate, other)),
      );

    if (spot) {
      chosen.placed.push(spot);
      chosen.spots[index] = { x: spot.x, y: spot.y };
    }
  }

  return chosen.spots;
}
