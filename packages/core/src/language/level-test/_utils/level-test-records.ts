import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../../cache/tags";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { type LevelTestProgress, type LevelTestQuestion } from "../level-test-contract";
import {
  canWriteLevelTest,
  levelTestDetailsWithProgress,
  readLevelTestProgress,
} from "./level-test-state";

type LevelTestAnswerRecord = {
  answer: LevelTestProgress["answers"][number];
  bankRunId: string;
  language: string;
  question: LevelTestQuestion;
  recordId: string;
  startScore: number;
  targetLanguage: string;
};

/** Callers save each answer once, under the learner's lock, so appending never repeats one. */
async function recordLevelTestAnswer(
  tx: TransactionClient,
  record: LevelTestAnswerRecord,
): Promise<void> {
  const answers = JSON.stringify([record.answer]);
  const questions = JSON.stringify([record.question]);

  await tx.$executeRaw`
    INSERT INTO anonymous_level_tests
      (id, language, target_language, bank_run_id, start_score, answers, questions)
    VALUES (
      ${record.recordId}::uuid, ${record.language}, ${record.targetLanguage}, ${record.bankRunId},
      ${record.startScore}, ${answers}::jsonb, ${questions}::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      answers = anonymous_level_tests.answers || EXCLUDED.answers,
      questions = anonymous_level_tests.questions || EXCLUDED.questions`;
}

/** Returns false if progress changed since `from`; callers must reload rather than overwrite it. */
export async function saveLevelTestProgress({
  from,
  goal,
  progress,
  record,
}: {
  from: LevelTestProgress;
  goal: Pick<Goal, "id" | "userId">;
  progress: LevelTestProgress;
  record?: LevelTestAnswerRecord;
}): Promise<boolean> {
  const saved = await writeLearnerChange({ userId: goal.userId }, async (tx) => {
    const current = await tx.goal.findUniqueOrThrow({ where: { id: goal.id } });

    if (
      !canWriteLevelTest(current, from) ||
      !isDeepStrictEqual(readLevelTestProgress(current, from.attemptId), from)
    ) {
      return unchanged(false);
    }

    await tx.goal.update({
      data: { details: levelTestDetailsWithProgress(current, progress) },
      where: { id: goal.id },
    });

    if (record) {
      await recordLevelTestAnswer(tx, record);
    }

    return true;
  });

  if (saved) {
    revalidateCacheTags([getGoalsCacheTag(goal.userId)]);
  }

  return saved;
}
