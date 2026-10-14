import "server-only";
import { prisma } from "@zoonk/db";
import { ITEM_SET_INCLUDE, toItemSetView } from "../../library/items/item-sets";
import { type ListeningSetView } from "../../library/listening/listening-set-view";

/**
 * A recording's transcript once the answer just given completes its questions in the block, or
 * decides a boss's duel, won or lost (`duelOver`), which ends it with any left unasked: before, the
 * script would answer them; after, it shows what was misheard. Null for a question on its own, a text's or a
 * chart's set, and a recording with questions still to answer.
 */
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
