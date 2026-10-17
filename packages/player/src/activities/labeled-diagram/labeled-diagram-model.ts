import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { spotNumber } from "@zoonk/core/library/activities/labeled-diagram";

/** Which name the learner put on each spot, by the spot's number. */
export type Placements = Readonly<Record<string, string>>;

/** A numbered spot of the picture and the name that belongs on it. */
export type DiagramSlot = { key: string; label: string; number: number };

/**
 * The parts as numbered spots, in the picture's order: the first part is spot 1, keyed like the
 * answer key core computes.
 */
export function diagramSlots(parts: readonly { label: string }[]): DiagramSlot[] {
  return parts.map((part, index) => ({
    key: spotNumber(index),
    label: part.label,
    number: index + 1,
  }));
}

/** Puts a name on a spot. A name already on another spot moves; the one it replaces goes back. */
export function placeName({
  key,
  name,
  placements,
}: {
  key: string;
  name: string;
  placements: Placements;
}): Placements {
  const others = Object.entries(placements).filter(([id, placed]) => id !== key && placed !== name);
  return Object.fromEntries([...others, [key, name]]);
}

export function removeName(placements: Placements, key: string): Placements {
  return Object.fromEntries(Object.entries(placements).filter(([id]) => id !== key));
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
  const start = slots.findIndex((slot) => slot.key === after) + 1;
  const rotated = [...slots.slice(start), ...slots.slice(0, start)];

  return rotated.find((slot) => placements[slot.key] === undefined)?.key ?? null;
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
  const isComplete = slots.every((slot) => placements[slot.key] !== undefined);
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
