import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { getSession } from "../users/get-session";
import { scheduleSensitivityCheck } from "./_utils/fact-sensitivity";
import { forgetExampleLines } from "./_utils/forget-example-lines";
import { toMemoryFactView } from "./_utils/memory-fact-view";
import { type MemoryFactUpdateInput, type MemoryFactView } from "./memory-contract";

/** A fact the learner wrote or corrected is what they said, so it's as certain as a fact can be. */
const LEARNER_CONFIDENCE = 1;

/** A concurrent deactivation after the plain ownership read must roll back the revision too. */
class MemoryFactUnavailableError extends Error {
  override name = "MemoryFactUnavailableError";
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

  const { data: fact, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.memoryFact.findFirst({
        select: { id: true },
        where: { id: factId, status: "active", userId },
      });

      if (!existing) {
        return null;
      }

      await markLearnerChanged(tx, { planInputs: false, userId });

      const { count } = await tx.memoryFact.updateMany({
        data: {
          category: input.category,
          confidence: LEARNER_CONFIDENCE,
          origin: "said",
          statement: input.statement,
        },
        where: { id: factId, status: "active", userId },
      });

      if (count === 0) {
        throw new MemoryFactUnavailableError();
      }

      const updated = await tx.memoryFact.findUniqueOrThrow({ where: { id: factId } });

      if (input.statement !== undefined) {
        await forgetExampleLines({ client: tx, userId });
      }

      return updated;
    }),
  );

  if (error instanceof MemoryFactUnavailableError) {
    return { status: "notFound" };
  }

  if (error) {
    throw error;
  }

  if (!fact) {
    return { status: "notFound" };
  }

  revalidateCacheTags([getMemoryCacheTag(userId)]);

  if (input.statement !== undefined) {
    scheduleSensitivityCheck(fact);
  }

  return { fact: toMemoryFactView(fact), status: "updated" };
}
