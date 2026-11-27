import { createHmac } from "node:crypto";
import { getAuthSecret } from "@zoonk/auth/auth-secret";
import { seededShuffle } from "@zoonk/utils/seeded-random";

const MAX_DRAWS = 32;

/** The stored order is the answer, so the shuffle is keyed by a secret the client never sees. */
function keySeed(seed: string): string {
  const secret = getAuthSecret();

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is missing, so questions can't be shuffled.");
  }

  return createHmac("sha256", secret).update(`shown-order:${seed}`).digest("hex");
}

function isStoredOrder(order: readonly number[]): boolean {
  return order.every((value, index) => value === index);
}

/**
 * Returns stored-entry indexes in stable shuffled display order; grading must use this order.
 * Never the stored order, except with two entries, whose only other order would give the answer away.
 */
export function getShownOrder({ count, seed }: { count: number; seed: string }): number[] {
  const indexes = Array.from({ length: count }, (_, index) => index);

  const draw = (attempt: number): number[] => {
    const shuffled = seededShuffle(indexes, keySeed(`${seed}:${attempt}`));
    const redraw = count > 2 && isStoredOrder(shuffled) && attempt < MAX_DRAWS;
    return redraw ? draw(attempt + 1) : shuffled;
  };

  return draw(0);
}

export function showInOrder<T>({ items, seed }: { items: readonly T[]; seed: string }): T[] {
  return getShownOrder({ count: items.length, seed }).flatMap((index) => {
    const item = items[index];
    return item === undefined ? [] : [item];
  });
}
