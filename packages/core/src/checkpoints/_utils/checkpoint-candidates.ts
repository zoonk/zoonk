import "server-only";
import { prisma } from "@zoonk/db";
import { getItemAudienceFilter } from "../../library/items/item-field";
import {
  QUESTION_ITEM_FORMATS,
  hasTraps,
  parseSessionItem,
} from "../../sessions/_utils/session-items";
import { type CheckpointItemCandidate } from "../checkpoint-rules";

/**
 * Questions on a set of skills as checkpoint candidates (choice questions and math problems):
 * whether a wrong answer carries a misconception (a classic trap) and whether the learner has seen
 * the question. Another exam's questions never count: general ones and the goal's exam's do.
 */
export async function loadCheckpointCandidates({
  examBlueprintId,
  skillIds,
  userId,
}: {
  /** The goal's exam, if any. */
  examBlueprintId: string | null;
  skillIds: readonly string[];
  userId: string;
}): Promise<CheckpointItemCandidate[]> {
  const items = await prisma.item.findMany({
    orderBy: { id: "asc" },
    where: {
      format: { in: [...QUESTION_ITEM_FORMATS] },
      skillId: { in: [...skillIds] },
      ...getItemAudienceFilter({ examBlueprintId }),
    },
  });

  const seen = await prisma.attempt.findMany({
    distinct: ["itemId"],
    select: { itemId: true },
    where: { itemId: { in: items.map((item) => item.id) }, userId },
  });

  const seenIds = new Set(seen.map((attempt) => attempt.itemId));

  return items
    .map((item) => parseSessionItem(item))
    .filter((item) => item !== null)
    .map((item) => ({
      hasMisconceptions: hasTraps(item),
      id: item.id,
      seen: seenIds.has(item.id),
      skillId: item.skillId,
    }));
}
