import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { getSession } from "../../users/get-session";
import { type WarmUpDeck, warmUpDeckSchema } from "./warm-up-contract";

export type WarmUpResult =
  | { deck: WarmUpDeck; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** A ready deck never changes; a broken one is deleted, and the next goal writes a new one. */
async function readReadyWarmUp(warmUpId: string): Promise<WarmUpDeck | null> {
  "use cache";

  const deck = await prisma.warmUp.findFirst({
    select: { cards: true, id: true, language: true },
    where: { id: warmUpId, status: "ready" },
  });

  return deck ? warmUpDeckSchema.parse(deck) : null;
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

  const deck = await readReadyWarmUp(warmUpId.toLowerCase());
  return deck ? { deck, status: "ready" } : { status: "notFound" };
}

/** The learner's goal's deck once it's ready, read with a page so its wait draws the card at once. */
export async function getGoalWarmUp(goalId: string): Promise<WarmUpDeck | null> {
  const owned = await findOwnedGoal(goalId);
  const warmUpId = owned.status === "ready" ? owned.goal.warmUpId : null;

  return warmUpId ? readReadyWarmUp(warmUpId) : null;
}
