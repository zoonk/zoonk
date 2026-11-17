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
const PIN_RADIUS = 20;
const HALF_TURN = 180;
export const MAP_STREET_SAMPLE_STEP = 4;
const MAX_STREET_OFFSET = 40;

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

export type MapLabelPlacement = MapPoint & { scale?: number; overPinCircle?: boolean };
const MIN_LABEL_SCALE = 0.8;
const LABEL_SCALES = [1, (1 + MIN_LABEL_SCALE) / 2, MIN_LABEL_SCALE] as const;

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

function besideOwnStreet(label: MapLabelSpot, streets: readonly (readonly MapPoint[])[]): boolean {
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
        distance < pathDistance(label, other),
    )
  );
}

function streetCandidates(label: MapLabelSpot): MapPoint[] {
  const [, normal] = axes(label);

  const offset = Math.min(
    MAX_STREET_OFFSET,
    projection(label, normal) + PIN_RADIUS + LABEL_CLEARANCE,
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

    return Array.from({ length: steps }, (_, step) => ({
      x: from.x + ((to.x - from.x) * step) / steps,
      y: from.y + ((to.y - from.y) * step) / steps,
    })).flatMap((point) =>
      offsets.map((across) => ({ x: point.x + normal.x * across, y: point.y + normal.y * across })),
    );
  });
}

function namedCandidates(
  label: MapLabelSpot,
  placed: readonly MapLabelSpot[],
  pins: readonly MapPoint[],
  frame: { width: number; height: number },
): MapPoint[] {
  if (label.kind === "street") {
    return streetCandidates(label);
  }

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
  pinNumbers,
  streets = labels.flatMap((label) =>
    label.kind === "street" && label.positions ? [label.positions] : [],
  ),
}: {
  streets?: readonly (readonly MapPoint[])[];
  pinNumbers?: readonly MapBox[];
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

  const clear = (
    candidate: MapLabelSpot,
    placed: readonly MapLabelSpot[],
    numbers?: readonly MapBox[],
  ) =>
    inFrame(candidate, frame) &&
    (numbers
      ? numbers.every(
          (box) =>
            Math.abs(candidate.x - box.x - box.width / 2) >=
              projection(candidate, { x: 1, y: 0 }) + box.width / 2 + LABEL_CLEARANCE ||
            Math.abs(candidate.y - box.y - box.height / 2) >=
              projection(candidate, { x: 0, y: 1 }) + box.height / 2 + LABEL_CLEARANCE,
        )
      : pins.every((pin) => clearOfPin(candidate, pin))) &&
    besideOwnStreet(candidate, streets) &&
    placed.every((other) => clearOfLabel(candidate, other));

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
        .find((candidate) => clear(candidate, placed));

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

  // At minimum size, a named street may cover a pin's circle, but never its number.
  if (pinNumbers?.length === pins.length) {
    for (const { index, label: original } of named.filter(
      (item) => !chosen.spots[item.index] && item.label.kind === "street",
    )) {
      const label = {
        ...original,
        height: original.height * MIN_LABEL_SCALE,
        width: original.width * MIN_LABEL_SCALE,
      };

      const spot = streetCandidates(label)
        .toSorted(
          (a, b) =>
            Math.hypot(a.x - label.x, a.y - label.y) - Math.hypot(b.x - label.x, b.y - label.y),
        )
        .map((point) => ({ ...label, ...point }))
        .find((candidate) => clear(candidate, chosen.placed, pinNumbers));

      if (spot) {
        chosen.placed.push(spot);
        chosen.spots[index] = { overPinCircle: true, scale: MIN_LABEL_SCALE, x: spot.x, y: spot.y };
      }
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
      .find((candidate) => clear(candidate, chosen.placed));

    if (spot) {
      chosen.placed.push(spot);
      chosen.spots[index] = { x: spot.x, y: spot.y };
    }
  }

  return chosen.spots;
}
