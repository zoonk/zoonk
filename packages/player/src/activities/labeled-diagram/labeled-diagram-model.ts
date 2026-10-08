import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type DiagramPoint } from "../_assets/diagrams/diagram-types";

/** Which name the learner put on each part, by part id. */
export type Placements = Readonly<Record<string, string>>;

/** Where a spot sits on the drawing, in words for screen readers. */
export type SpotPosition =
  | "bottom"
  | "bottomLeft"
  | "bottomRight"
  | "center"
  | "left"
  | "right"
  | "top"
  | "topLeft"
  | "topRight";

export type DiagramSlot = {
  anchor: DiagramPoint;
  label: string;
  number: number;
  partId: string;
  pin: DiagramPoint;
  position: SpotPosition;
};

/** Pins closer than this vertically read as one row, left to right. */
const ROW_HEIGHT = 36;
const THIRDS = 3;

const POSITIONS: readonly (readonly SpotPosition[])[] = [
  ["topLeft", "top", "topRight"],
  ["left", "center", "right"],
  ["bottomLeft", "bottom", "bottomRight"],
];

function third(value: number, size: number): number {
  return Math.min(Math.floor((value / size) * THIRDS), THIRDS - 1);
}

function spotPosition([x, y]: DiagramPoint, size: { height: number; width: number }): SpotPosition {
  return POSITIONS[third(y, size.height)]?.[third(x, size.width)] ?? "center";
}

/**
 * The lesson's parts as numbered spots, numbered in reading order of their pins (top to bottom,
 * left to right), so the numbers never hint at the order the writer listed the answers in.
 */
export function orderSlots({
  drawing,
  parts,
}: {
  drawing: {
    height: number;
    parts: Readonly<Record<string, { anchor: DiagramPoint; pin?: DiagramPoint }>>;
    width: number;
  };
  parts: readonly { label: string; partId: string }[];
}): DiagramSlot[] {
  return parts
    .flatMap((part) => {
      const placement = drawing.parts[part.partId];

      if (!placement) {
        return [];
      }

      const pin = placement.pin ?? placement.anchor;
      return [{ ...part, anchor: placement.anchor, pin, position: spotPosition(pin, drawing) }];
    })
    .toSorted(
      (first, second) =>
        Math.round(first.pin[1] / ROW_HEIGHT) - Math.round(second.pin[1] / ROW_HEIGHT) ||
        first.pin[0] - second.pin[0],
    )
    .map((slot, index) => ({ ...slot, number: index + 1 }));
}

/** Puts a name on a part. A name already on another part moves; the one it replaces goes back. */
export function placeName({
  name,
  partId,
  placements,
}: {
  name: string;
  partId: string;
  placements: Placements;
}): Placements {
  const others = Object.entries(placements).filter(
    ([id, placed]) => id !== partId && placed !== name,
  );

  return Object.fromEntries([...others, [partId, name]]);
}

export function removeName(placements: Placements, partId: string): Placements {
  return Object.fromEntries(Object.entries(placements).filter(([id]) => id !== partId));
}

/** The first empty spot after `after` (wrapping around), or null when every spot has a name. */
export function nextEmptySlot({
  after,
  placements,
  slots,
}: {
  after: string | null;
  placements: Placements;
  slots: readonly DiagramSlot[];
}): string | null {
  const start = slots.findIndex((slot) => slot.partId === after) + 1;
  const rotated = [...slots.slice(start), ...slots.slice(0, start)];

  return rotated.find((slot) => placements[slot.partId] === undefined)?.partId ?? null;
}

/** Names still waiting to be placed, in the bank's order. */
export function unplacedNames(names: readonly string[], placements: Placements): string[] {
  const placed = new Set(Object.values(placements));
  return names.filter((name) => !placed.has(name));
}

/** The assignment to grade once every spot has a name; null while any is empty. */
export function assignmentAnswer(
  slots: readonly DiagramSlot[],
  placements: Placements,
): ActivityAnswer | null {
  const isComplete = slots.every((slot) => placements[slot.partId] !== undefined);
  return isComplete ? { kind: "assignment", pairs: { ...placements } } : null;
}

/** The writer's feedback for a likely mix-up, when the learner made exactly that one. */
export function mixUpFeedback({
  correct,
  mixUps,
  placed,
}: {
  correct: string;
  mixUps: readonly { feedback: string; labels: readonly string[] }[];
  placed: string | undefined;
}): string | null {
  if (placed === undefined || placed === correct) {
    return null;
  }

  return (
    mixUps.find((mixUp) => mixUp.labels.includes(placed) && mixUp.labels.includes(correct))
      ?.feedback ?? null
  );
}
