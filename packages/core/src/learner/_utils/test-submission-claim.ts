import "server-only";
import { setTimeout as wait } from "node:timers/promises";
import { prisma } from "@zoonk/db";

/** Longer than any submission takes: an older claim was left by a crash. */
const CLAIM_TTL_MS = 300_000;
const CLAIM_POLL_MS = 500;

/** The claim's time is its owner's: releasing it never drops a claim taken over after a crash. */
async function takeClaim({ key, userId }: { key: string; userId: string }) {
  const now = new Date();

  await prisma.testSubmissionClaim.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - CLAIM_TTL_MS) }, key },
  });

  const { count } = await prisma.testSubmissionClaim.createMany({
    data: [{ createdAt: now, key, userId }],
    skipDuplicates: true,
  });

  return count > 0 ? now : null;
}

/**
 * Runs `submit` while holding the request's claim, a row rather than a lock held open: its domain
 * writers commit their own transactions, and a held transaction kept a connection idle while the
 * work waited for others from the same pool. A saved receipt (`replay`) answers instead, before
 * waiting on anyone's claim; `submit` must check for it again once it holds the claim.
 */
export async function withTestSubmissionClaim<Result>({
  key,
  replay,
  submit,
  userId,
}: {
  key: string;
  replay: () => Promise<Result | null>;
  submit: () => Promise<Result>;
  userId: string;
}): Promise<Result> {
  const replayed = await replay();

  if (replayed) {
    return replayed;
  }

  const claimedAt = await takeClaim({ key, userId });

  if (!claimedAt) {
    await wait(CLAIM_POLL_MS);
    return withTestSubmissionClaim({ key, replay, submit, userId });
  }

  try {
    return await submit();
  } finally {
    await prisma.testSubmissionClaim.deleteMany({ where: { createdAt: claimedAt, key } });
  }
}
