import { type Mistake, type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getMistakePracticeBefore } from "./mistake-availability";

/** Only recall on a later local day fixes mistakes; returns only entries this answer changed, excluding concurrent fixes. */
export async function fixMistakesAnsweredRight(
  {
    answeredAt,
    itemId,
    practicedMistakeId,
    stepId,
    timeZone,
    userId,
  }: {
    answeredAt: Date;
    itemId: string | null;
    practicedMistakeId?: string | null;
    stepId: string | null;
    timeZone: string;
    userId: string;
  },
  transaction: TransactionClient = prisma,
): Promise<Pick<Mistake, "cause" | "id" | "skillId">[]> {
  const targets = [
    itemId ? { itemId } : null,
    stepId ? { stepId } : null,
    practicedMistakeId ? { id: practicedMistakeId } : null,
  ].filter((target) => target !== null);

  if (targets.length === 0) {
    return [];
  }

  const startOfToday = getMistakePracticeBefore({
    localDate: getDateInTimeZone({ date: answeredAt, timeZone }),
    timeZone,
  });

  return transaction.mistake.updateManyAndReturn({
    data: { fixedAt: answeredAt, status: "fixed" },
    select: { cause: true, id: true, skillId: true },
    where: { OR: targets, createdAt: { lt: startOfToday }, status: "open", userId },
  });
}
