import { type Mistake, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getStartOfLocalDay } from "../learner/_utils/local-time";

/**
 * Marks notebook entries fixed after a right answer: the same question, or the mistake a practice
 * drill targeted. Only mistakes from an earlier learner-local day count, because fixing means
 * remembering on a later day, not repeating the answer that was just shown. Returns the mistakes
 * this answer fixed; one fixed by a concurrent answer isn't returned twice.
 */
export async function fixMistakesAnsweredRight({
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
}): Promise<Pick<Mistake, "cause" | "id" | "skillId">[]> {
  const targets = [
    itemId ? { itemId } : null,
    stepId ? { stepId } : null,
    practicedMistakeId ? { id: practicedMistakeId } : null,
  ].filter((target) => target !== null);

  if (targets.length === 0) {
    return [];
  }

  const startOfToday = getStartOfLocalDay({
    localDate: getDateInTimeZone({ date: answeredAt, timeZone }),
    timeZone,
  });

  return prisma.mistake.updateManyAndReturn({
    data: { fixedAt: answeredAt, status: "fixed" },
    select: { cause: true, id: true, skillId: true },
    where: { OR: targets, createdAt: { lt: startOfToday }, status: "open", userId },
  });
}
