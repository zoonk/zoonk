import "server-only";
import { prisma } from "@zoonk/db";
import { ITEM_SET_INCLUDE, toItemSetView } from "../../library/items/item-sets";
import { type ListeningSetView } from "../../library/listening/listening-set-view";

/** Hide the transcript until all recording questions are answered or a duel ends; return null for non-recording sets. */
export async function loadAnsweredTranscript({
  blockItemIds,
  duelOver,
  itemId,
  sessionId,
  setId,
  userId,
}: {
  blockItemIds: readonly string[];
  duelOver: boolean;
  itemId: string;
  sessionId: string;
  setId: string | null;
  userId: string;
}): Promise<ListeningSetView["transcript"]> {
  if (!setId) {
    return null;
  }

  const [row, asked, answers] = await Promise.all([
    prisma.item.findUnique({ include: ITEM_SET_INCLUDE, where: { id: itemId } }),
    prisma.item.count({ where: { id: { in: [...blockItemIds] }, setId } }),
    prisma.attempt.findMany({
      distinct: ["itemId"],
      select: { itemId: true },
      where: {
        item: { setId },
        itemId: { in: [...blockItemIds] },
        studySessionId: sessionId,
        userId,
      },
    }),
  ]);

  if (row?.set?.kind !== "audio" || (!duelOver && answers.length < asked)) {
    return null;
  }

  return toItemSetView({ item: row, reveal: true })?.listening?.transcript ?? null;
}
