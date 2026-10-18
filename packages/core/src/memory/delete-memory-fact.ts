import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { toMemoryFactView } from "./_utils/memory-fact-view";
import { removeMemoryFact } from "./_utils/memory-writes";
import { type MemoryChange } from "./memory-contract";

export type MemoryFactDeleteResult =
  | { change: Extract<MemoryChange, { action: "removed" }>; status: "deleted" }
  | { status: "notFound" | "unauthorized" };

/**
 * Deletes one of the learner's facts together with the facts it replaced. Zoonk stops using it
 * right away; the learner can undo for 30 days, after which it's purged for good.
 */
export async function deleteMemoryFact(factId: string): Promise<MemoryFactDeleteResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(factId)) {
    return { status: "notFound" };
  }

  const userId = session.user.id;
  const removed = await removeMemoryFact({ factId, userId });

  if (!removed) {
    return { status: "notFound" };
  }

  revalidateCacheTags([getMemoryCacheTag(userId)]);

  const change = { action: "removed" as const, fact: null, previous: toMemoryFactView(removed) };

  return { change, status: "deleted" };
}
