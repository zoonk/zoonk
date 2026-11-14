import "server-only";
import {
  isFixedDuringTest,
  loadLevelTestContext,
  saveLevelTestProgress,
  toLevelTestView,
} from "./_utils/level-test-state";
import { type LanguageLevelTestView, type LevelTestAnswerInput } from "./level-test-contract";
import { levelTestPart } from "./level-test-parts";
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

  const { bank, bankId, bankRunId, bankWrittenAt, owned, progress } = context;

  if (!bank || !bankId || !bankRunId) {
    return { status: "notReady" };
  }

  const step = getNextLevelTestStep({ bank, progress, start: progress.start });

  // A second tap, another device or a bank check that removed the question leaves the screen behind:
  // it gets where the test is now instead of an error it would retry forever.
  if (step.kind !== "question" || step.question.id !== input.questionId) {
    return {
      status: "ready",
      test: await toLevelTestView({ bank, bankWrittenAt, goal: owned.goal, progress }),
    };
  }

  if (input.skipped && step.question.skill !== "listening") {
    return { status: "invalid" };
  }

  // A skip uses the question's turn without moving the level, as a not-right answer to a
  // question fixed while the learner was on it does.
  const skipped =
    input.skipped === true ||
    (input.answerIndex !== step.question.answerIndex &&
      (await isFixedDuringTest({
        bankId,
        goal: owned.goal,
        part: levelTestPart({ kind: "question", questionId: step.question.id }),
        progress,
      })));

  const answerIndex = skipped ? null : input.answerIndex;

  const answer = {
    answerIndex,
    correct: answerIndex === null ? null : answerIndex === step.question.answerIndex,
    durationMs: input.durationMs ?? 0,
    id: input.questionId,
    ...(skipped && { skipped: true }),
  };

  const recordId = progress.recordId ?? crypto.randomUUID();

  const next = {
    ...progress,
    answers: [...progress.answers, answer],
    recordId,
    startedAt: progress.startedAt ?? new Date().toISOString(),
  };

  const saved = await saveLevelTestProgress({
    from: progress,
    goal: owned.goal,
    progress: next,
    record: {
      answer,
      bankRunId,
      language: owned.goal.language,
      question: step.question,
      recordId,
      startScore: progress.start,
      targetLanguage: owned.goal.targetLanguage,
    },
  });

  if (!saved) {
    return { status: "invalid" };
  }

  return {
    status: "ready",
    test: await toLevelTestView({
      bank,
      bankWrittenAt,
      goal: owned.goal,
      lastCorrect: skipped ? null : answer.correct === true,
      progress: next,
    }),
  };
}
