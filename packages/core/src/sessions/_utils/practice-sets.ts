import { type ItemSetPick } from "../../library/items/item-sets";

/**
 * Practice questions as they're asked: a set's questions (a passage, a case, a chart or a
 * recording they share) together, any other question alone.
 */
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

/**
 * The practice questions that fit `room`, in order. A set is asked whole or not at all: one that
 * doesn't fit is left for another day and the questions after it take its place, since half a
 * passage's questions would test the passage, not the skills.
 */
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

/**
 * The sets practice asks on a skill's turn, as units it orders with the skill's other questions:
 * those whose first skill in practice's order is this one, so a set spanning skills comes once. A
 * set has no field or difficulty of its own.
 */
export function toSetUnits({
  isOne,
  listeningSkillIds,
  ordered,
  sets,
  skillId,
}: {
  /**
   * One question confirms the skill today (a topic the learner was taken to know), so its sets
   * wait. A listening skill's recordings are its only questions, so its first one, asked whole,
   * confirms it.
   */
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

/**
 * The sets practice can ask: a set is asked whole, so it waits while any of its questions is held
 * back (`isAsked`), and a text set never asks a skill only recordings practice.
 */
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
