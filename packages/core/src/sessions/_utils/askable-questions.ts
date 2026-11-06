import "server-only";
import { prisma } from "@zoonk/db";
import { getCheckpointQuestionCount } from "../../checkpoints/_utils/checkpoint-answer-evidence";
import { ITEM_IMAGE_INCLUDE, isMissingItsPicture } from "../../library/items/item-image";
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
    select: {
      ...ITEM_IMAGE_INCLUDE,
      content: true,
      format: true,
      id: true,
      language: true,
      skillId: true,
    },
    where: { id: { in: [...itemIds] } },
  });

  return getCheckpointQuestionCount({
    answeredItemIds,
    askableItemIds: rows
      .map((row) => parseSessionItem(row))
      .filter((item) => item !== null)
      .filter((item) => !isMissingItsPicture(item))
      .map((item) => item.id),
  });
}
