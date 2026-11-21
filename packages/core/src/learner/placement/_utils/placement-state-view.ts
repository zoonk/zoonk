import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { ITEM_IMAGE_INCLUDE } from "../../../library/items/item-image";
import { type PlacementStatus } from "../placement-contract";
import {
  type PlacementQuestionView,
  parsePlacementItem,
  toPlacementQuestionView,
} from "./placement-items";

export async function loadQuestion(
  itemId: string | undefined,
  tx: TransactionClient = prisma,
): Promise<PlacementQuestionView | null> {
  if (!itemId) {
    return null;
  }

  const item = await tx.item.findUnique({ include: ITEM_IMAGE_INCLUDE, where: { id: itemId } });
  const parsed = item ? parsePlacementItem(item) : null;

  return parsed ? toPlacementQuestionView(parsed) : null;
}

export function getStatus({
  buildFailed,
  complete,
  dayBudgetUsed,
  hasEvidence,
  hasNext,
  hasSkills,
  tested,
  waitsForQuestions,
}: {
  buildFailed: boolean;
  complete: boolean;
  dayBudgetUsed: boolean;
  /** Any answer on the plan's skills, placement's or not. */
  hasEvidence: boolean;
  hasNext: boolean;
  hasSkills: boolean;
  /** An exam goal's Focus test has nothing to ask outside a sitting, which isn't "unavailable". */
  tested: boolean;
  waitsForQuestions: boolean;
}): PlacementStatus {
  if (!hasSkills) {
    return buildFailed ? "failed" : "preparing";
  }

  if (hasNext) {
    return "asking";
  }

  if (complete || dayBudgetUsed) {
    return "done";
  }

  if (waitsForQuestions) {
    return "waitingForQuestions";
  }

  return hasEvidence || tested ? "done" : "unavailable";
}
