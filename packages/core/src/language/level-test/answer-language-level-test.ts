import "server-only";
import {
  loadLevelTestContext,
  saveLevelTestProgress,
  toLevelTestView,
} from "./_utils/level-test-state";
import { type LanguageLevelTestView, type LevelTestAnswerInput } from "./level-test-contract";
import { getNextLevelTestStep } from "./level-test-rules";

export type AnswerLanguageLevelTestResult =
  | { status: "invalid" | "notFound" | "notLanguage" | "notReady" | "unauthorized" }
  | { status: "ready"; test: LanguageLevelTestView };

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

  const { bank, bankWrittenAt, owned, progress } = context;

  if (!bank) {
    return { status: "notReady" };
  }

  const step = getNextLevelTestStep({ bank, progress, start: progress.start });

  if (step.kind !== "question" || step.question.id !== input.questionId) {
    return { status: "invalid" };
  }

  if (input.skipped && step.question.skill !== "listening") {
    return { status: "invalid" };
  }

  const answer = {
    answerIndex: input.skipped ? null : input.answerIndex,
    durationMs: input.durationMs ?? 0,
    id: input.questionId,
    ...(input.skipped && { skipped: true }),
  };

  const next = { ...progress, answers: [...progress.answers, answer] };

  if (!(await saveLevelTestProgress({ from: progress, goal: owned.goal, progress: next }))) {
    return { status: "invalid" };
  }

  return {
    status: "ready",
    test: await toLevelTestView({
      bank,
      bankWrittenAt,
      goal: owned.goal,
      lastCorrect: input.skipped ? null : input.answerIndex === step.question.answerIndex,
      progress: next,
    }),
  };
}
