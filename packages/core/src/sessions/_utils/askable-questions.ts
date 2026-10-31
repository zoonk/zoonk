import "server-only";
import { prisma } from "@zoonk/db";
import { getCheckpointQuestionCount } from "../../checkpoints/_utils/checkpoint-answer-evidence";
import { parseSessionItem } from "./session-items";

/** Includes previously answered ids; removed bank content cannot hold a checkpoint open forever. */
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
