import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { after } from "next/server";
import { trackLearnerEvents } from "../analytics/track-learner-event";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { toMemoryFactView } from "./_utils/memory-fact-view";
import { removeMemoryFact } from "./_utils/memory-writes";
import { type MemoryChange } from "./memory-contract";

export type MemoryFactDeleteResult =
  | { change: Extract<MemoryChange, { action: "removed" }>; status: "deleted" }
  | { status: "notFound" | "unauthorized" };

/** Also deletes the facts it replaced. The learner can undo it for 30 days. */
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

  after(() =>
    trackLearnerEvents({
      events: [
        {
          name: "Memory Updated",
          properties: {
            category: change.previous.category,
            change: "deleted",
            origin: change.previous.origin,
          },
        },
      ],
      userId,
    }),
  );

  return { change, status: "deleted" };
}
