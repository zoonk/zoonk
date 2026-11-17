import { LABEL_CLEARANCE } from "../_utils/drawing-label";
import { clamp } from "../_utils/snap-value";
import {
  MAP_PIN_RADIUS,
  type MapLabelSpot,
  besideOwnStreet,
  labelProjection,
  streetCandidates,
} from "./map-label-geometry";
import { type MapBox, type MapPoint } from "./map-viewport";

function clearOfLabel(label: MapLabelSpot, other: MapLabelSpot): boolean {
  return (
    Math.abs(label.x - other.x) >=
      labelProjection(label, { x: 1, y: 0 }) +
        labelProjection(other, { x: 1, y: 0 }) +
        LABEL_CLEARANCE ||
    Math.abs(label.y - other.y) >=
      labelProjection(label, { x: 0, y: 1 }) +
        labelProjection(other, { x: 0, y: 1 }) +
        LABEL_CLEARANCE
  );
}

function clearOfPin(label: MapLabelSpot, pin: MapPoint): boolean {
  return (
    Math.abs(label.x - pin.x) >=
      labelProjection(label, { x: 1, y: 0 }) + MAP_PIN_RADIUS + LABEL_CLEARANCE ||
    Math.abs(label.y - pin.y) >=
      labelProjection(label, { x: 0, y: 1 }) + MAP_PIN_RADIUS + LABEL_CLEARANCE
  );
}

function inFrame(label: MapLabelSpot, frame: { height: number; width: number }): boolean {
  const rx = labelProjection(label, { x: 1, y: 0 });
  const ry = labelProjection(label, { x: 0, y: 1 });

  return (
    label.x >= rx && label.x + rx <= frame.width && label.y >= ry && label.y + ry <= frame.height
  );
}

export type MapLabelPlacement = MapPoint & { scale?: number; overPinCircle?: boolean };
const MIN_LABEL_SCALE = 0.8;
const LABEL_SCALES = [1, (1 + MIN_LABEL_SCALE) / 2, MIN_LABEL_SCALE] as const;

function namedCandidates(
  label: MapLabelSpot,
  placed: readonly MapLabelSpot[],
  pins: readonly MapPoint[],
  frame: { width: number; height: number },
): MapPoint[] {
  if (label.kind === "street") {
    return streetCandidates(label);
  }

  const rx = labelProjection(label, { x: 1, y: 0 });
  const ry = labelProjection(label, { x: 0, y: 1 });

  if (rx * 2 > frame.width || ry * 2 > frame.height) {
    return [];
  }

  const seeds = [...(label.positions ?? []), label];

  const obstacles = [
    ...placed.map((other) => ({
      rx: labelProjection(other, { x: 1, y: 0 }),
      ry: labelProjection(other, { x: 0, y: 1 }),
      x: other.x,
      y: other.y,
    })),
    ...pins.map((pin) => ({ ...pin, rx: MAP_PIN_RADIUS, ry: MAP_PIN_RADIUS })),
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
    onPath = false,
  ) =>
    inFrame(candidate, frame) &&
    (numbers
      ? numbers.every(
          (box) =>
            Math.abs(candidate.x - box.x - box.width / 2) >=
              labelProjection(candidate, { x: 1, y: 0 }) + box.width / 2 + LABEL_CLEARANCE ||
            Math.abs(candidate.y - box.y - box.height / 2) >=
              labelProjection(candidate, { x: 0, y: 1 }) + box.height / 2 + LABEL_CLEARANCE,
        )
      : pins.every((pin) => clearOfPin(candidate, pin))) &&
    (onPath || besideOwnStreet(candidate, streets)) &&
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

  // The last resort stays on the street's line and may cover a circle, never its number.
  if (pinNumbers?.length === pins.length) {
    for (const { index, label: original } of named.filter(
      (item) => !chosen.spots[item.index] && item.label.kind === "street",
    )) {
      const label = {
        ...original,
        height: original.height * MIN_LABEL_SCALE,
        width: original.width * MIN_LABEL_SCALE,
      };

      const spot = streetCandidates(label, {
        boxes: [
          ...pinNumbers,
          ...chosen.placed.map((other) => {
            const rx = labelProjection(other, { x: 1, y: 0 }) + LABEL_CLEARANCE;
            const ry = labelProjection(other, { x: 0, y: 1 }) + LABEL_CLEARANCE;
            return { height: ry * 2, width: rx * 2, x: other.x - rx, y: other.y - ry };
          }),
        ],
        frame,
      })
        .toSorted(
          (a, b) =>
            Math.hypot(a.x - label.x, a.y - label.y) - Math.hypot(b.x - label.x, b.y - label.y),
        )
        .map((point) => ({ ...label, ...point }))
        .find((candidate) => clear(candidate, chosen.placed, pinNumbers, true));

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
