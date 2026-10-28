import "server-only";
import { setTimeout as wait } from "node:timers/promises";
import { type Attempt, type TransactionClient, prisma, sql } from "@zoonk/db";

const DAILY_ESSAY_GRADES = 6;

const CLAIM_LOCK_NAMESPACE = 51_883;

const CLAIM_TTL_MS = 360_000;

const CLAIM_POLL_MS = 500;

function getLiveSince(now: Date): Date {
  return new Date(now.getTime() - CLAIM_TTL_MS);
}

async function lockClaims(transaction: TransactionClient, userId: string): Promise<void> {
  await transaction.$queryRaw(
    sql`SELECT pg_advisory_xact_lock(${CLAIM_LOCK_NAMESPACE}::int, hashtext(${userId}))::text`,
  );
}

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

export type EssayGradeClaim =
  | { attemptId: string; status: "claimed" | "limitReached" }
  | { attemptId: string; saved: Attempt; status: "saved" };

type ClaimRound = EssayGradeClaim | { attemptId: string; status: "taken" };

function isSettled(claim: ClaimRound): claim is EssayGradeClaim {
  return claim.status !== "taken";
}

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

    await tx.essayGradeClaim.deleteMany({ where: { id: { in: claimedIds } } });

    await tx.essayGradeClaim.createMany({
      data: claimedIds.map((id) => ({ createdAt: now, id, localDate, userId })),
    });

    return rounds;
  });
}

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

export async function endEssayGradeClaim(
  transaction: TransactionClient,
  { attemptId, userId }: { attemptId: string; userId: string },
): Promise<void> {
  await lockClaims(transaction, userId);
  await transaction.essayGradeClaim.deleteMany({ where: { id: attemptId } });
}

/** The caller must record each claimed grade or release its claim with `releaseEssayGradeClaims`. */
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
