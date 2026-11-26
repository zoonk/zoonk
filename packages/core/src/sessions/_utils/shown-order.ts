import { createHmac } from "node:crypto";
import { getAuthSecret } from "@zoonk/auth/auth-secret";
import { seededShuffle } from "@zoonk/utils/seeded-random";

/** The stored order is the answer, so the shuffle is keyed by a secret the client never sees. */
function keySeed(seed: string): string {
  const secret = getAuthSecret();

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is missing, so questions can't be shuffled.");
  }

  return createHmac("sha256", secret).update(`shown-order:${seed}`).digest("hex");
}

/** Returns stored-entry indexes in stable shuffled display order; grading must use this order. */
export function getShownOrder({ count, seed }: { count: number; seed: string }): number[] {
  const indexes = Array.from({ length: count }, (_, index) => index);
  const shuffled = seededShuffle(indexes, keySeed(seed));
  const unchanged = shuffled.every((value, index) => value === index);

  return unchanged ? [...shuffled.slice(1), ...shuffled.slice(0, 1)] : shuffled;
}
