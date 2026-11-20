import "server-only";
import { prisma } from "@zoonk/db";
import {
  claimGuestSpend,
  fitsGuestSpend,
  readGuestSpentMicros,
} from "../../../entitlements/_utils/guest-spend-budget";

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

export function reserveWritingPromptSpend({
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
