import "server-only";
import { prisma } from "@zoonk/db";
import { isSinglePick } from "../../learner/_utils/choice-items";
import { listItemSetsForSkills } from "../../library/items/item-sets";
import { type SessionItem, parseSessionItem } from "../../sessions/_utils/session-items";
import { type RecordingSet, pickWholeRecordingSets } from "../checkpoint-minutes";

function isDuelQuestion(item: SessionItem): boolean {
  if (item.format === "multipleChoice") {
    return isSinglePick(item);
  }

  return item.format === "trueFalse" || item.format === "numeric" || item.format === "typed";
}

/** Unheard recordings first, then least recently heard; null userId uses creation order without reading answers. */
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

/** Returns no items until whole voiced recordings can make a boss. */
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

export function countBlockRecordings(itemIds: readonly string[]): Promise<number> {
  return prisma.itemSet.count({
    where: { items: { some: { id: { in: [...itemIds] } } }, kind: "audio" },
  });
}
