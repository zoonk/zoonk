import "server-only";
import { prisma } from "@zoonk/db";
import { type BlockCapsule } from "../block-payload";
import { loadRightAnswers } from "./load-review-capsules";

/** Reserve mistakes' own questions for drills and checkpoints' unseen questions for the duel. */
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

/** Recordings play whole, so excluding one question must exclude its recording siblings. */
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

/** Review days must not repeat questions answered right on the previous review day. */
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
