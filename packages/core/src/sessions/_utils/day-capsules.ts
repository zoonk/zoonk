import "server-only";
import { prisma } from "@zoonk/db";
import { type BlockCapsule } from "../block-payload";
import { loadRightAnswers } from "./load-review-capsules";

/**
 * A mistake's own question belongs to its drill, where fixing it counts for the mission, and a
 * checkpoint's questions stay unseen until the duel, so capsules leave both out, with a review
 * day's questions answered right last time. A capsule left without questions is covered by the
 * drill, checkpoint or practice on its skill.
 */
function withoutLeftOutItems({
  capsules,
  leftOut,
}: {
  capsules: readonly BlockCapsule[];
  leftOut: ReadonlySet<string>;
}): BlockCapsule[] {
  return capsules
    .map((capsule) => ({ ...capsule, itemIds: capsule.itemIds.filter((id) => !leftOut.has(id)) }))
    .filter((capsule) => capsule.itemIds.length > 0);
}

/**
 * The questions left out with their recording: a recording plays whole or not at all, so one of
 * its questions left out (see `withoutLeftOutItems`) takes the others in the capsules with it.
 */
async function withRecordingSiblings({
  itemIds,
  leftOut,
}: {
  itemIds: readonly string[];
  leftOut: ReadonlySet<string>;
}): Promise<ReadonlySet<string>> {
  if (leftOut.size === 0 || itemIds.length === 0) {
    return leftOut;
  }

  const recorded = await prisma.item.findMany({
    select: { id: true, setId: true },
    where: { id: { in: [...itemIds] }, set: { kind: "audio" } },
  });

  const cutSets = new Set(recorded.flatMap((item) => (leftOut.has(item.id) ? [item.setId] : [])));

  return new Set([
    ...leftOut,
    ...recorded.flatMap((item) => (cutSets.has(item.setId) ? [item.id] : [])),
  ]);
}

/**
 * Today's capsules without the questions other blocks hold (see `withoutLeftOutItems`); a review
 * day's, like its practice, never ask again what was answered right last time.
 */
export async function loadDayCapsules({
  capsules,
  isReviewDay,
  reserved,
  userId,
}: {
  capsules: readonly BlockCapsule[];
  isReviewDay: boolean;
  reserved: ReadonlySet<string>;
  userId: string;
}): Promise<BlockCapsule[]> {
  const itemIds = capsules.flatMap((capsule) => capsule.itemIds);

  const answeredRight = isReviewDay
    ? await loadRightAnswers({ itemIds, userId })
    : new Set<string>();

  const leftOut = await withRecordingSiblings({
    itemIds,
    leftOut: new Set([...reserved, ...answeredRight]),
  });

  return withoutLeftOutItems({ capsules, leftOut });
}
