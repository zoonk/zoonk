import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../../users/get-session";
import { readReadyWarmUpId } from "./claim-warm-up";
import { type WarmUpDeck, warmUpDeckSchema } from "./warm-up-contract";

export type WarmUpResult =
  | { deck: WarmUpDeck; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Only a ready deck's id reaches this, and a ready deck never changes. */
async function readWarmUpCards(warmUpId: string): Promise<WarmUpDeck> {
  "use cache";

  const deck = await prisma.warmUp.findUniqueOrThrow({
    select: { cards: true, id: true, language: true },
    where: { id: warmUpId },
  });

  return warmUpDeckSchema.parse(deck);
}

/** Shared content for any learner or guest; a deck still being written or failed isn't served. */
export async function getWarmUp(warmUpId: string): Promise<WarmUpResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(warmUpId)) {
    return { status: "notFound" };
  }

  const readyId = await readReadyWarmUpId(warmUpId.toLowerCase());

  if (!readyId) {
    return { status: "notFound" };
  }

  return { deck: await readWarmUpCards(readyId), status: "ready" };
}
