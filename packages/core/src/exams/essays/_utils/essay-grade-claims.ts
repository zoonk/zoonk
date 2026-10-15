import "server-only";
import { setTimeout as wait } from "node:timers/promises";
import { type Attempt, type TransactionClient, prisma, sql } from "@zoonk/db";

/** Essays a learner can have graded in a day: plenty to write and rewrite, bounded for cost. */
const DAILY_ESSAY_GRADES = 6;

/** Namespaces the per-learner claim lock so it never collides with other advisory locks. */
const CLAIM_LOCK_NAMESPACE = 51_883;

/**
 * Longer than any grade takes (a request's own time limit): a claim this old was left by a request
 * that crashed, so it no longer counts and its draft can be claimed again.
 */
const CLAIM_TTL_MS = 360_000;

/** How often a request waiting for another one's grade of the same draft looks again. */
const CLAIM_POLL_MS = 500;

function getLiveSince(now: Date): Date {
  return new Date(now.getTime() - CLAIM_TTL_MS);
}

/**
 * Claiming a learner's grades and ending a claim with its recorded grade take this lock, so a claim
 * round sees each draft either claimed or graded, never between the two.
 */
async function lockClaims(transaction: TransactionClient, userId: string): Promise<void> {
  await transaction.$queryRaw(
    sql`SELECT pg_advisory_xact_lock(${CLAIM_LOCK_NAMESPACE}::int, hashtext(${userId}))::text`,
  );
}

/**
 * Essay grades the learner has left on their local day: the day's graded essays and the grades
 * still being made count, so drafts sent at once can't grade past the limit.
 */
export async function countGradesLeft({
  localDate,
  now,
  transaction = prisma,
  userId,
}: {
  localDate: Date;
  now: Date;
  transaction?: TransactionClient;
  userId: string;
}): Promise<number> {
  // One query, so a grade being recorded (its claim ending as its attempt is saved) is counted once.
  const counts = await transaction.user.findUnique({
    select: {
      _count: {
        select: {
          attempts: { where: { item: { format: "essay" }, localDate } },
          essayGradeClaims: { where: { createdAt: { gt: getLiveSince(now) }, localDate } },
        },
      },
    },
    where: { id: userId },
  });

  const used = (counts?._count.attempts ?? 0) + (counts?._count.essayGradeClaims ?? 0);
  return Math.max(0, DAILY_ESSAY_GRADES - used);
}

/** What a request may do with one draft: grade it, replay its grade, or neither today. */
export type EssayGradeClaim =
  | { attemptId: string; status: "claimed" | "limitReached" }
  | { attemptId: string; saved: Attempt; status: "saved" };

type ClaimRound = EssayGradeClaim | { attemptId: string; status: "taken" };

function isSettled(claim: ClaimRound): claim is EssayGradeClaim {
  return claim.status !== "taken";
}

/**
 * One short transaction under the learner's lock, with no model call in it: each draft already
 * graded is `saved`; one another request is grading (a live claim) is `taken`; the others are
 * claimed in order while the day has grades left, and `limitReached` after that.
 */
function claimRound({
  attemptIds,
  localDate,
  userId,
}: {
  attemptIds: readonly string[];
  localDate: Date;
  userId: string;
}): Promise<ClaimRound[]> {
  return prisma.$transaction(async (tx) => {
    await lockClaims(tx, userId);

    const now = new Date();
    const liveSince = getLiveSince(now);

    const [saved, claims, left] = await Promise.all([
      tx.attempt.findMany({ where: { id: { in: [...attemptIds] }, userId } }),
      tx.essayGradeClaim.findMany({
        select: { id: true },
        where: { createdAt: { gt: liveSince }, id: { in: [...attemptIds] } },
      }),
      countGradesLeft({ localDate, now, transaction: tx, userId }),
    ]);

    let grades = left;

    const rounds = attemptIds.map((attemptId): ClaimRound => {
      const attempt = saved.find((row) => row.id === attemptId);

      if (attempt) {
        return { attemptId, saved: attempt, status: "saved" };
      }

      if (claims.some((claim) => claim.id === attemptId)) {
        return { attemptId, status: "taken" };
      }

      if (grades === 0) {
        return { attemptId, status: "limitReached" };
      }

      grades -= 1;
      return { attemptId, status: "claimed" };
    });

    const claimedIds = rounds.flatMap((round) =>
      round.status === "claimed" ? [round.attemptId] : [],
    );

    // A claim a crashed request left behind is taken over.
    await tx.essayGradeClaim.deleteMany({ where: { id: { in: claimedIds } } });

    await tx.essayGradeClaim.createMany({
      data: claimedIds.map((id) => ({ createdAt: now, id, localDate, userId })),
    });

    return rounds;
  });
}

/** Frees drafts this request claimed and didn't record (a failed grade), so a retry can grade. */
export async function releaseEssayGradeClaims({
  attemptIds,
  userId,
}: {
  attemptIds: readonly string[];
  userId: string;
}): Promise<void> {
  if (attemptIds.length > 0) {
    await prisma.essayGradeClaim.deleteMany({ where: { id: { in: [...attemptIds] }, userId } });
  }
}

/** Recording a draft's grade ends its claim, in the transaction that records it. */
export async function endEssayGradeClaim(
  transaction: TransactionClient,
  { attemptId, userId }: { attemptId: string; userId: string },
): Promise<void> {
  await lockClaims(transaction, userId);
  await transaction.essayGradeClaim.deleteMany({ where: { id: attemptId } });
}

/**
 * Claims the drafts' grades before any model is called (see `claimRound`), so the same draft sent
 * twice at once is graded once: while another request grades one of them, this one frees what it
 * claimed and waits, holding no connection, until that grade is recorded (`saved`, replayed), fails
 * (the draft is claimed again) or its claim expires. A claimed draft is graded and recorded by the
 * caller, whose recording ends the claim (`endEssayGradeClaim`); one it doesn't record must be
 * released (`releaseEssayGradeClaims`).
 */
export async function claimEssayGrades(input: {
  attemptIds: readonly string[];
  localDate: Date;
  userId: string;
}): Promise<EssayGradeClaim[]> {
  const rounds = await claimRound(input);
  const settled = rounds.filter((round) => isSettled(round));

  if (settled.length === rounds.length) {
    return settled;
  }

  await releaseEssayGradeClaims({
    attemptIds: settled.flatMap((claim) => (claim.status === "claimed" ? [claim.attemptId] : [])),
    userId: input.userId,
  });

  await wait(CLAIM_POLL_MS);
  return claimEssayGrades(input);
}
