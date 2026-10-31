import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { spotNumber } from "@zoonk/core/library/activities/labeled-diagram";

export type Placements = Readonly<Record<string, string>>;

export type DiagramSlot = { key: string; label: string; number: number };

export function diagramSlots(parts: readonly { label: string }[]): DiagramSlot[] {
  return parts.map((part, index) => ({
    key: spotNumber(index),
    label: part.label,
    number: index + 1,
  }));
}

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

export function unplacedNames(names: readonly string[], placements: Placements): string[] {
  const placed = new Set(Object.values(placements));
  return names.filter((name) => !placed.has(name));
}

export function assignmentAnswer(
  slots: readonly DiagramSlot[],
  placements: Placements,
): ActivityAnswer | null {
  const isComplete = slots.every((slot) => placements[slot.key] !== undefined);
  return isComplete ? { kind: "assignment", pairs: { ...placements } } : null;
}

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
