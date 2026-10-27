import "server-only";
import { type MemoryFact } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getSession } from "../users/get-session";
import { scheduleSensitivityCheck } from "./_utils/fact-sensitivity";
import { forgetExampleLines } from "./_utils/forget-example-lines";
import { toMemoryFactView } from "./_utils/memory-fact-view";
import { type MemoryFactUpdateInput, type MemoryFactView } from "./memory-contract";

/** A fact the learner wrote or corrected is what they said, so it's as certain as a fact can be. */
const LEARNER_CONFIDENCE = 1;

/** Whether the fact already reads as this correction would leave it. */
function isSameCorrection({
  fact,
  input,
}: {
  fact: Pick<MemoryFact, "category" | "confidence" | "origin" | "statement">;
  input: MemoryFactUpdateInput;
}): boolean {
  return (
    fact.origin === "said" &&
    fact.confidence === LEARNER_CONFIDENCE &&
    (input.category === undefined || input.category === fact.category) &&
    (input.statement === undefined || input.statement === fact.statement)
  );
}

export type MemoryFactUpdateResult =
  | { fact: MemoryFactView; status: "updated" }
  | { status: "notFound" | "unauthorized" };

/**
 * Saves the learner's correction of one fact in place, so the old wording isn't kept anywhere, not
 * even in an example line written from it.
 * The fact becomes something the learner said, and a new wording is checked for sensitive details
 * after the response.
 */
export async function updateMemoryFact({
  factId,
  input,
}: {
  factId: string;
  input: MemoryFactUpdateInput;
}): Promise<MemoryFactUpdateResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(factId)) {
    return { status: "notFound" };
  }

  const userId = session.user.id;

  const saved = await writeLearnerChange({ userId }, async (tx) => {
    // Read under the revision lock: a concurrent save or delete of this fact finished first.
    const existing = await tx.memoryFact.findFirst({
      where: { id: factId, status: "active", userId },
    });

    if (!existing) {
      return unchanged(null);
    }

    // The same correction saved again leaves the fact, its example lines and the revision alone.
    if (isSameCorrection({ fact: existing, input })) {
      return unchanged({ changed: false, fact: existing });
    }

    const updated = await tx.memoryFact.update({
      data: {
        category: input.category,
        confidence: LEARNER_CONFIDENCE,
        origin: "said",
        statement: input.statement,
      },
      where: { id: factId },
    });

    if (input.statement !== undefined) {
      await forgetExampleLines({ client: tx, userId });
    }

    return { changed: true, fact: updated };
  });

  if (!saved) {
    return { status: "notFound" };
  }

  if (saved.changed) {
    revalidateCacheTags([getMemoryCacheTag(userId)]);
  }

  if (saved.changed && input.statement !== undefined) {
    scheduleSensitivityCheck(saved.fact);
  }

  return { fact: toMemoryFactView(saved.fact), status: "updated" };
}
