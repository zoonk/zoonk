import "server-only";
import {
  getTestStart,
  loadLevelTestContext,
  saveLevelTestProgress,
  toLevelTestView,
} from "./_utils/level-test-state";
import { type LanguageLevelTestView, type LevelTestAnswerInput } from "./level-test-contract";
import { getNextLevelTestStep } from "./level-test-rules";

export type AnswerLanguageLevelTestResult =
  | { status: "invalid" | "notFound" | "notLanguage" | "notReady" | "unauthorized" }
  | { status: "ready"; test: LanguageLevelTestView };

/**
 * Records one answer of the level test ("I don't know" included, which the test welcomes) and
 * returns what comes next. Only the question the test is asking can be answered, once.
 */
export async function answerLanguageLevelTest({
  goalId,
  input,
}: {
  goalId: string;
  input: LevelTestAnswerInput;
}): Promise<AnswerLanguageLevelTestResult> {
  const context = await loadLevelTestContext(goalId);

  if (context.status !== "ready") {
    return context;
  }

  const { bank, owned, progress } = context;

  if (!bank) {
    return { status: "notReady" };
  }

  const step = getNextLevelTestStep({ bank, progress, start: getTestStart(owned.goal) });

  if (step.kind !== "question" || step.question.id !== input.questionId) {
    return { status: "invalid" };
  }

  const next = {
    ...progress,
    answers: [
      ...progress.answers,
      { answerIndex: input.answerIndex, durationMs: input.durationMs ?? 0, id: input.questionId },
    ],
  };

  await saveLevelTestProgress({ goal: owned.goal, progress: next });

  return {
    status: "ready",
    test: toLevelTestView({
      bank,
      goal: owned.goal,
      lastCorrect: input.answerIndex === step.question.answerIndex,
      progress: next,
    }),
  };
}
