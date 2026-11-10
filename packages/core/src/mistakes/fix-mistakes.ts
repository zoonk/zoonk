import { type Mistake, type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getMistakePracticeBefore } from "./mistake-availability";
import { type MistakeReplay, loadMistakeReplays, readMistakeReplay } from "./mistake-replay";
import { isSameMistakeQuestion } from "./mistake-replay-identity";
import { readMistakeSnapshot } from "./mistake-snapshot";

/** Only recall on a later local day fixes mistakes; returns only entries this answer changed, excluding concurrent fixes. */
export async function fixMistakesAnsweredRight(
  {
    answeredAt,
    itemId,
    practiceQuestion,
    practicedMistakeId,
    stepId,
    replay,
    questionText,
    timeZone,
    userId,
  }: {
    answeredAt: Date;
    itemId: string | null;
    practiceQuestion?: { kind: "item" | "lesson"; id: string };
    practicedMistakeId?: string | null;
    stepId: string | null;
    replay?: MistakeReplay;
    questionText?: string;
    timeZone: string;
    userId: string;
  },
  transaction: TransactionClient = prisma,
): Promise<Pick<Mistake, "cause" | "id" | "skillId">[]> {
  const targets = [
    itemId ? { itemId } : null,
    stepId ? { stepId } : null,
    practiceQuestion && practicedMistakeId
      ? {
          id: practicedMistakeId,
          snapshot: {
            equals: practiceQuestion.id,
            path:
              practiceQuestion.kind === "item"
                ? ["replay", "item", "id"]
                : ["replay", "lesson", "step", "id"],
          },
        }
      : null,
  ].filter((target) => target !== null);

  if (targets.length === 0) {
    return [];
  }

  const startOfToday = getMistakePracticeBefore({
    localDate: getDateInTimeZone({ date: answeredAt, timeZone }),
    timeZone,
  });

  const candidates = await transaction.mistake.findMany({
    where: {
      ...(practicedMistakeId ? { id: practicedMistakeId } : {}),
      OR: targets,
      createdAt: { lt: startOfToday },
      status: "open",
      userId,
    },
  });

  const legacyNumeric =
    !practicedMistakeId && replay?.kind === "item" && replay.item.format === "numeric"
      ? candidates.filter((mistake) => !readMistakeReplay(mistake.snapshot))
      : [];

  const restored = await loadMistakeReplays({ mistakes: legacyNumeric, userId });

  const exactIds = candidates.flatMap((mistake) => {
    const saved = readMistakeReplay(mistake.snapshot) ?? restored.get(mistake.id);

    const matches =
      practicedMistakeId ||
      (saved
        ? replay && isSameMistakeQuestion({ answered: replay, saved })
        : !questionText || readMistakeSnapshot(mistake.snapshot).question === questionText);

    return matches ? [mistake.id] : [];
  });

  return transaction.mistake.updateManyAndReturn({
    data: { fixedAt: answeredAt, status: "fixed" },
    select: { cause: true, id: true, skillId: true },
    where: { id: { in: exactIds }, status: "open", userId },
  });
}
