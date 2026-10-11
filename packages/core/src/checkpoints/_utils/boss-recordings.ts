import "server-only";
import { prisma } from "@zoonk/db";
import { isSinglePick } from "../../learner/_utils/choice-items";
import { listItemSetsForSkills } from "../../library/items/item-sets";
import { type SessionItem, parseSessionItem } from "../../sessions/_utils/session-items";
import { MIN_CHECKPOINT_QUESTIONS } from "../checkpoint-rules";

/** What a duel asks: one tap, a number, or a few typed words, never several options. */
function isDuelQuestion(item: SessionItem): boolean {
  if (item.format === "multipleChoice") {
    return isSinglePick(item);
  }

  return item.format === "trueFalse" || item.format === "numeric" || item.format === "typed";
}

/**
 * The questions of the recordings a boss plays for a phase of skills practiced only with
 * recordings (an exam's Listening): whole voiced recordings on them, never heard first, then the
 * ones heard longest ago, each only when the duel can ask every one of its questions, until the
 * duel has enough. Empty while no recording can make one (none is voiced yet): the boss waits.
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

  const whole = recordings.filter((set) => set.items.every((item) => askable.has(item.id)));

  const enough = whole.findIndex(
    (_, index) =>
      whole.slice(0, index + 1).flatMap((set) => set.items).length >= MIN_CHECKPOINT_QUESTIONS,
  );

  return enough === -1
    ? []
    : whole.slice(0, enough + 1).flatMap((set) => set.items.map((item) => item.id));
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
