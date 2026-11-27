import { type Mistake, type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { visibleMistakeWhere } from "./_utils/visible-mistake";
import { listReadyMistakes } from "./mistake-availability";
import { type MistakeReplay, loadMistakeReplays, readMistakeReplay } from "./mistake-replay";
import { isSameMistakeQuestion } from "./mistake-replay-identity";
import { readMistakeSnapshot } from "./mistake-snapshot";

/** Only recall on a later local day than the last miss fixes mistakes; returns only entries this answer changed, excluding concurrent fixes. */
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
): Promise<{ fixed: Pick<Mistake, "cause" | "id" | "skillId">[]; replayed: boolean }> {
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
    return { fixed: [], replayed: false };
  }

  const candidates = await transaction.mistake.findMany({
    where: {
      AND: [visibleMistakeWhere, { OR: targets }],
      ...(practicedMistakeId ? { id: practicedMistakeId } : {}),
      userId,
    },
  });

  const legacyNumeric =
    !practicedMistakeId && replay?.kind === "item" && replay.item.format === "numeric"
      ? candidates.filter((mistake) => !readMistakeReplay(mistake.snapshot))
      : [];

  const restored = await loadMistakeReplays({ mistakes: legacyNumeric, userId });

  const exact = candidates.filter((mistake) => {
    const saved = readMistakeReplay(mistake.snapshot) ?? restored.get(mistake.id);

    const matches =
      practicedMistakeId ||
      (saved
        ? replay && isSameMistakeQuestion({ answered: replay, saved })
        : !questionText || readMistakeSnapshot(mistake.snapshot).question === questionText);

    return Boolean(matches);
  });

  const ready = listReadyMistakes({
    localDate: getDateInTimeZone({ date: answeredAt, timeZone }),
    mistakes: exact.filter(({ status }) => status === "open"),
    timeZone,
  });

  if (ready.length === 0) {
    return { fixed: [], replayed: exact.length > 0 };
  }

  const fixed = await transaction.mistake.updateManyAndReturn({
    data: { fixedAt: answeredAt, status: "fixed" },
    select: { cause: true, id: true, skillId: true },
    where: { id: { in: ready.map(({ id }) => id) }, status: "open", userId },
  });

  return { fixed, replayed: true };
}
