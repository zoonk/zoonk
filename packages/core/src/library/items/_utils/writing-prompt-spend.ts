import "server-only";
import { prisma } from "@zoonk/db";
import {
  claimGuestSpend,
  fitsGuestSpend,
  readGuestSpentMicros,
} from "../../../entitlements/_utils/guest-spend-budget";
import { type WritingSupplyInput, loadWritingSupply } from "../writing-prompt-pool";

const PROMPT_COST_MICROS = 10_000;

export async function canFundWritingPrompts(userId: string, count: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    select: { isAnonymous: true },
    where: { id: userId },
  });

  return Boolean(
    user &&
    (!user.isAnonymous ||
      fitsGuestSpend({
        costMicros: count * PROMPT_COST_MICROS,
        spentMicros: await readGuestSpentMicros(new Date()),
      })),
  );
}

function reserveWritingPromptSpend({
  count,
  runId,
  userId,
}: {
  count: number;
  runId: string;
  userId: string;
}): Promise<number | null> {
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      select: { isAnonymous: true },
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    if (!user.isAnonymous) {
      return count;
    }

    const claimed = await transaction.writingPromptSpend.createMany({
      data: { count, runId },
      skipDuplicates: true,
    });

    if (claimed.count === 0) {
      const prior = await transaction.writingPromptSpend.findUniqueOrThrow({ where: { runId } });
      return prior.count;
    }

    const allowed = await claimGuestSpend({
      costMicros: count * PROMPT_COST_MICROS,
      now: new Date(),
      transaction,
    });

    if (!allowed) {
      await transaction.writingPromptSpend.delete({ where: { runId } });
      return null;
    }

    return count;
  });
}

export async function admitWritingPromptWork({
  input,
  poolToken,
  runId,
}: {
  input: WritingSupplyInput;
  poolToken: string;
  runId: string;
}) {
  const supply = await loadWritingSupply(input, poolToken);
  const count = supply?.missing ?? 0;

  if (count === 0) {
    return { count, status: "ready" as const };
  }

  const reserved = await reserveWritingPromptSpend({ count, runId, userId: input.userId });

  return reserved === null
    ? { count: 0, status: "signUpRequired" as const }
    : { count: reserved, status: "writing" as const };
}

export async function requireWritingPromptSpend({
  runId,
  slot,
  userId,
}: {
  runId: string;
  slot: number;
  userId: string;
}): Promise<void> {
  const user = await prisma.user.findUnique({
    select: { isAnonymous: true },
    where: { id: userId },
  });

  if (user && !user.isAnonymous) {
    return;
  }

  const reservation = await prisma.writingPromptSpend.findUnique({ where: { runId } });

  if (!user || !Number.isInteger(slot) || slot < 0 || slot >= (reservation?.count ?? 0)) {
    throw new Error("Writing prompt slot has no spend reservation.");
  }
}
