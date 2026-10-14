import "server-only";
import { prisma } from "@zoonk/db";
import { getCheckpointQuestionCount } from "../../checkpoints/_utils/checkpoint-answer-evidence";
import { parseSessionItem } from "./session-items";

/**
 * The questions a block can still ask: its items the bank still holds, as its screen shows them
 * (`getStudyBlock`). One removed since it started (a picture that failed its checks) is never
 * asked, so a checkpoint is answered in full, or decided, without it (`getAskablePassMark`).
 */
export async function countAskableQuestions({
  answeredItemIds = [],
  itemIds,
}: {
  answeredItemIds?: Iterable<string>;
  itemIds: readonly string[];
}): Promise<number> {
  const rows = await prisma.item.findMany({
    select: { content: true, format: true, id: true, language: true, skillId: true },
    where: { id: { in: [...itemIds] } },
  });

  return getCheckpointQuestionCount({
    answeredItemIds,
    askableItemIds: rows.filter((row) => parseSessionItem(row) !== null).map((row) => row.id),
  });
}
