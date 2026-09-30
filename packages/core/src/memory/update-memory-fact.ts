import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { scheduleDepthPreferenceRefresh } from "./_utils/depth-preference";
import { scheduleSensitivityCheck } from "./_utils/fact-sensitivity";
import { getMemoryAccess } from "./_utils/memory-access";
import { toMemoryFactView } from "./_utils/memory-fact-view";
import { type MemoryFactUpdateInput, type MemoryFactView } from "./memory-contract";

/** A fact the learner wrote or corrected is what they said, so it's as certain as a fact can be. */
const LEARNER_CONFIDENCE = 1;

export type MemoryFactUpdateResult =
  | { fact: MemoryFactView; status: "updated" }
  | { status: "categoryNotAllowed" | "notFound" | "unauthorized" };

/**
 * Saves the learner's correction of one fact in place, so the old wording isn't kept anywhere.
 * The fact becomes something the learner said, and a new wording is checked for sensitive details
 * after the response. A category outside what their memory may hold (only goals and learning for
 * minors) is refused.
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
  const access = await getMemoryAccess(userId);

  if (input.category && !access.categories.includes(input.category)) {
    return { status: "categoryNotAllowed" };
  }

  const { count } = await prisma.memoryFact.updateMany({
    data: {
      category: input.category,
      confidence: LEARNER_CONFIDENCE,
      origin: "said",
      statement: input.statement,
    },
    where: { id: factId, status: "active", userId },
  });

  if (count === 0) {
    return { status: "notFound" };
  }

  revalidateCacheTags([getMemoryCacheTag(userId)]);

  const fact = await prisma.memoryFact.findUniqueOrThrow({ where: { id: factId } });

  if (input.statement !== undefined) {
    scheduleSensitivityCheck(fact);
  }

  // A category change may move a note into or out of preferences.
  if (fact.category === "preferences" || input.category !== undefined) {
    scheduleDepthPreferenceRefresh(userId);
  }

  return { fact: toMemoryFactView(fact), status: "updated" };
}
