import "server-only";
import { prisma } from "@zoonk/db";
import { type BlockCapsule } from "../block-payload";

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

/** Exclude reservations from capsules that have already been picked. */
export async function loadUnreservedCapsules({
  capsules,
  reserved,
}: {
  capsules: readonly BlockCapsule[];
  reserved: ReadonlySet<string>;
}): Promise<BlockCapsule[]> {
  const itemIds = capsules.flatMap((capsule) => capsule.itemIds);
  const leftOut = await withRecordingSiblings({ itemIds, leftOut: reserved });

  return withoutLeftOutItems({ capsules, leftOut });
}
