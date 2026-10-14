import "server-only";
import { prisma } from "@zoonk/db";
import { isSinglePick } from "../../learner/_utils/choice-items";
import { listItemSetsForSkills } from "../../library/items/item-sets";
import { type SessionItem, parseSessionItem } from "../../sessions/_utils/session-items";
import { type RecordingSet, pickWholeRecordingSets } from "../checkpoint-minutes";

/** What a duel asks: one tap, a number, or a few typed words, never several options. */
function isDuelQuestion(item: SessionItem): boolean {
  if (item.format === "multipleChoice") {
    return isSinglePick(item);
  }

  return item.format === "trueFalse" || item.format === "numeric" || item.format === "typed";
}

/**
 * A goal's voiced recordings on `skills`, as a boss can play them (see `RecordingSet`), in the order
 * the learner hears them next: never heard first, then the ones heard longest ago; for no learner
 * (`userId` null), in the order they were written.
 */
export async function listRecordingSets({
  examBlueprintId,
  skillIds,
  userId,
}: {
  examBlueprintId: string | null;
  skillIds: readonly string[];
  userId: string | null;
}): Promise<RecordingSet[]> {
  const sets = await listItemSetsForSkills({ examBlueprintId, skillIds, userId });
  const recordings = sets.filter((set) => set.kind === "audio");

  const rows = await prisma.item.findMany({
    where: { id: { in: recordings.flatMap((set) => set.items.map((item) => item.id)) } },
  });

  const askable = new Set(
    rows.flatMap((row) => {
      const item = parseSessionItem(row);
      return item && isDuelQuestion(item) ? [item.id] : [];
    }),
  );

  return recordings.map((set) => ({
    itemIds: set.items.map((item) => item.id),
    skillIds: set.skillIds,
    whole: set.items.every((item) => askable.has(item.id)),
  }));
}

/**
 * The questions of the recordings a boss plays for a phase of skills practiced only with
 * recordings (an exam's Listening): whole voiced recordings on them (see `pickWholeRecordingSets`).
 * Empty while no recording can make one (none is voiced yet): the boss waits.
 */
export async function loadBossRecordingItems({
  examBlueprintId,
  skillIds,
  userId,
}: {
  examBlueprintId: string | null;
  skillIds: readonly string[];
  userId: string;
}): Promise<string[]> {
  return pickWholeRecordingSets(await listRecordingSets({ examBlueprintId, skillIds, userId }));
}

/**
 * How many recordings a checkpoint's questions are on: a listening phase's boss plays them
 * (`loadBossRecordingItems`), so its intro says so; 0 for text questions.
 */
export function countBlockRecordings(itemIds: readonly string[]): Promise<number> {
  return prisma.itemSet.count({
    where: { items: { some: { id: { in: [...itemIds] } } }, kind: "audio" },
  });
}
