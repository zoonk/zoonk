import { type ItemSetPick } from "../../library/items/item-sets";

function groupPracticeUnits<T extends { setId?: string | null }>(practice: readonly T[]): T[][] {
  return practice.reduce<T[][]>((units, item) => {
    const last = units.at(-1);

    if (item.setId && last?.[0]?.setId === item.setId) {
      last.push(item);
      return units;
    }

    units.push([item]);
    return units;
  }, []);
}

/** Never split a stimulus set; skip an oversized set and let later fitting questions take its place. */
export function takePracticeQuestions<T extends { setId?: string | null }>({
  practice,
  room,
}: {
  practice: readonly T[];
  room: number;
}): T[] {
  return groupPracticeUnits(practice).reduce<T[]>((taken, unit) => {
    if (taken.length + unit.length <= room) {
      taken.push(...unit);
    }

    return taken;
  }, []);
}

/** A set spanning skills belongs to its first ordered skill only, preventing duplicate playback. */
export function toSetUnits({
  isOne,
  listeningSkillIds,
  ordered,
  sets,
  skillId,
}: {
  /** Single-question confirmations exclude sets except indivisible listening recordings. */
  isOne: boolean;
  listeningSkillIds: ReadonlySet<string>;
  ordered: readonly string[];
  sets: readonly ItemSetPick[];
  skillId: string;
}) {
  if (isOne && !listeningSkillIds.has(skillId)) {
    return [];
  }

  return sets
    .filter((set) => ordered.find((id) => set.skillIds.includes(id)) === skillId)
    .map((set) => ({
      difficulty: null,
      examBlueprintId: set.examBlueprintId,
      field: null,
      id: set.id,
      lastAnsweredAt: set.lastAnsweredAt,
      questions: set.items.map((item) => ({
        itemId: item.id,
        setId: set.id,
        skillId: item.skillId,
      })),
      skillId,
    }));
}

/** Ask sets whole only when none of their questions are held back; text sets exclude recording-only skills. */
export function listAskedSets({
  isAsked,
  listeningSkillIds,
  sets,
}: {
  isAsked: (itemId: string) => boolean;
  listeningSkillIds: ReadonlySet<string>;
  sets: readonly ItemSetPick[];
}): ItemSetPick[] {
  return sets.filter(
    (set) =>
      set.items.every((item) => isAsked(item.id)) &&
      (set.kind === "audio" || !set.skillIds.some((skillId) => listeningSkillIds.has(skillId))),
  );
}
