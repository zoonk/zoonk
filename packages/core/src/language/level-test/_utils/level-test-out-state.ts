import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { readGoalDetails } from "../../_utils/language-goal";
import { type LevelTestOutProgress } from "../level-test-out-contract";
import { readLevelTestDetails } from "../read-level-test-summary";
import { loadTestOutItem, toTestOutQuestion } from "./level-test-out-items";

export function saveTestOut({
  goal,
  progress,
  tx,
}: {
  goal: Pick<Goal, "details" | "id">;
  progress: LevelTestOutProgress;
  tx: TransactionClient;
}) {
  const details = {
    ...readGoalDetails(goal),
    levelTest: { ...readLevelTestDetails(goal), testOut: progress },
  };

  return tx.goal.update({ data: { details }, where: { id: goal.id } });
}

export async function loadTestOutAnswers({
  tx,
  progress,
  userId,
}: {
  tx: TransactionClient;
  progress: LevelTestOutProgress;
  userId: string;
}) {
  return tx.attempt.findMany({
    orderBy: [{ answeredAt: "asc" }, { id: "asc" }],
    select: {
      durationMs: true,
      isCorrect: true,
      item: { select: { content: true, format: true } },
      itemId: true,
      localDate: true,
      skillId: true,
    },
    where: { focusTestId: progress.id, userId },
  });
}

export async function nextTestOutQuestion({
  answered,
  progress,
  tx,
}: {
  answered: ReadonlySet<string | null>;
  progress: LevelTestOutProgress;
  tx: TransactionClient;
}) {
  if (progress.result) {
    return null;
  }

  const next = progress.questions.find(({ id }) => !answered.has(id));

  if (!next) {
    return null;
  }

  const row = await loadTestOutItem({ id: next.id, tx });

  if (!row || row.skillId !== next.skillId) {
    return null;
  }

  const question = toTestOutQuestion({ attemptId: progress.id, row, skill: next.skill });
  return question ? { question, row } : null;
}

export async function readTestOutView({
  progress,
  tx,
  userId,
}: Parameters<typeof loadTestOutAnswers>[0]) {
  const answers = await loadTestOutAnswers({ progress, tx, userId });

  const next = await nextTestOutQuestion({
    answered: new Set(answers.map(({ itemId }) => itemId)),
    progress,
    tx,
  });

  return {
    answered: answers.length,
    attemptId: progress.id,
    level: progress.level,
    next: next?.question ?? null,
    result: progress.result
      ? {
          finishedAt: progress.result.finishedAt,
          lessonsSkipped: progress.result.planItemIds.length,
          topicsSkipped: progress.result.topicsSkipped,
        }
      : null,
    total: progress.questions.length,
  };
}
