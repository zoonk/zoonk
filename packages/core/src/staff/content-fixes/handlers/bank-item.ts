import { type TransactionClient } from "@zoonk/db";
import { CURRENT_STEPS } from "../../../library/lessons/lesson-versions";
import { PRIVATE_CONTENT, refuse } from "../_utils/resolved-change";

/**
 * A practice question a fix may change on its own. A set's questions share one passage, and a
 * question a current screen asks is the same question as that screen, so those change with it.
 */
export async function loadBankItem(db: TransactionClient, id: string) {
  const item = await db.item.findUnique({
    include: {
      _count: { select: { steps: { where: CURRENT_STEPS } } },
      skill: { select: { visibility: true } },
    },
    where: { id },
  });

  if (!item) {
    return refuse(`No Item with id ${id}.`);
  }

  if (item.skill.visibility === "private") {
    return refuse(PRIVATE_CONTENT);
  }

  if (item.retiredAt) {
    return refuse(`Item ${id} is retired, so practice no longer asks it.`);
  }

  if (item.setId) {
    return refuse(
      "This question belongs to a set that shares one passage; it changes with its set, not alone.",
    );
  }

  return item._count.steps > 0
    ? refuse("A current lesson screen asks this question; fix that screen instead.")
    : { item, ok: true as const };
}
