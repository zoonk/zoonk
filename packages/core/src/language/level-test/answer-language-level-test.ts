import "server-only";
import { gradedTestAnswer, testEventContext, trackTestEvents } from "../../analytics/test-events";
import { matchesExpectedAnswer } from "../../library/activities/templates/_utils/grade-interaction";
import { toBankAnswer } from "./_utils/level-test-shown-order";
import {
  canWriteLevelTest,
  isFixedDuringTest,
  loadLevelTestContext,
  saveLevelTestProgress,
  toLevelTestView,
} from "./_utils/level-test-state";
import {
  LANGUAGE_LEVEL_TEST_OFFER,
  type LanguageLevelTestView,
  type LevelTestAnswerInput,
  type LevelTestConfirmation,
  type LevelTestQuestion,
} from "./level-test-contract";
import { levelTestPart } from "./level-test-parts";
import { getNextLevelTestStep } from "./level-test-rules";

export type AnswerLanguageLevelTestResult =
  | { status: "invalid" | "notFound" | "notLanguage" | "notReady" | "unauthorized" }
  | { status: "ready"; test: LanguageLevelTestView };

type Answer = { input: LevelTestAnswerInput; question: LevelTestConfirmation | LevelTestQuestion };

function isValidLevelTestAnswer({ input, question }: Answer): boolean {
  const indices = input.answerIndices;
  const confirmation = "answerIndices" in question;

  return !(
    (input.audioDeferred && (input.answerIndex !== null || indices || input.skipped)) ||
    ((input.skipped || input.audioDeferred) && question.skill !== "listening") ||
    (confirmation && input.answerIndex !== null) ||
    (!confirmation && indices) ||
    indices?.some((index) => index >= question.options.length)
  );
}

function gradeLevelTestAnswer({ input, question }: Answer): boolean | null {
  if ("answerIndex" in question) {
    return input.answerIndex === null ? null : input.answerIndex === question.answerIndex;
  }

  if (!input.answerIndices) {
    return null;
  }

  return matchesExpectedAnswer(
    { ids: question.answerIndices.map(String), kind: "selection" },
    { ids: input.answerIndices.map(String), kind: "selection" },
  );
}

type ReadyContext = Extract<Awaited<ReturnType<typeof loadLevelTestContext>>, { status: "ready" }>;

async function gradeCurrentQuestion({
  bankId,
  goal,
  input,
  progress,
  question,
}: Answer & {
  bankId: string;
  goal: ReadyContext["owned"]["goal"];
  progress: ReadyContext["progress"];
}) {
  const indices = input.answerIndices;
  const correct = gradeLevelTestAnswer({ input, question });

  const skipped =
    input.audioDeferred === true ||
    input.skipped === true ||
    (correct !== true &&
      (await isFixedDuringTest({
        bankId,
        goal,
        part: levelTestPart({ kind: "question", questionId: question.id }),
        progress,
      })));

  const answerIndex = skipped ? null : input.answerIndex;

  return {
    answeredAt: new Date().toISOString(),
    ...(input.audioDeferred && { audioDeferred: true }),
    answerIndex,
    ...(indices && !skipped && { answerIndices: indices }),
    correct: skipped ? null : correct,
    durationMs: input.durationMs ?? 0,
    id: input.questionId,
    ...(skipped && { skipped: true }),
  };
}

function trackAcceptedAnswer({
  answer,
  check,
  goal,
  progress,
  question,
  questionNumber,
}: {
  answer: Awaited<ReturnType<typeof gradeCurrentQuestion>>;
  check: boolean;
  goal: ReadyContext["owned"]["goal"];
  progress: ReadyContext["progress"];
  question: Answer["question"];
  questionNumber: number;
}) {
  const properties = {
    ...testEventContext(goal, {
      attemptId: progress.attemptId,
      questions: LANGUAGE_LEVEL_TEST_OFFER.total,
      test: "language",
    }),
    level: question.level,
    question_number: questionNumber,
  };

  if (answer.audioDeferred) {
    trackTestEvents(goal, [
      {
        name: "Test Audio Deferred",
        properties: { ...properties, kind: check ? "check" : "listening" },
      },
    ]);
  } else if (!answer.skipped) {
    trackTestEvents(goal, [
      {
        name: "Test Answered",
        properties: {
          ...properties,
          answer: gradedTestAnswer({ correct: answer.correct }),
          duration_ms: answer.durationMs,
          kind: check ? "check" : question.skill,
        },
      },
    ]);
  }
}

export async function answerLanguageLevelTest({
  goalId,
  input,
}: {
  goalId: string;
  input: LevelTestAnswerInput;
}): Promise<AnswerLanguageLevelTestResult> {
  const context = await loadLevelTestContext(goalId, input.attemptId);

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
  if (
    !canWriteLevelTest(owned.goal, progress) ||
    (step.kind !== "question" && step.kind !== "confirmation") ||
    step.question.id !== input.questionId
  ) {
    return {
      status: "ready",
      test: await toLevelTestView({ bank, bankWrittenAt, goal: owned.goal, progress }),
    };
  }

  if (!isValidLevelTestAnswer({ input, question: step.question })) {
    return { status: "invalid" };
  }

  const answer = await gradeCurrentQuestion({
    bankId,
    goal: owned.goal,
    input: toBankAnswer({
      attemptId: progress.attemptId,
      goalId: owned.goal.id,
      input,
      question: step.question,
    }),
    progress,
    question: step.question,
  });

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
    record:
      step.kind === "question"
        ? {
            answer,
            bankRunId,
            language: owned.goal.language,
            question: step.question,
            recordId,
            startScore: progress.start,
            targetLanguage: owned.goal.targetLanguage,
          }
        : undefined,
  });

  if (!saved) {
    return { status: "invalid" };
  }

  trackAcceptedAnswer({
    answer,
    check: step.kind === "confirmation",
    goal: owned.goal,
    progress,
    question: step.question,
    questionNumber: next.answers.length,
  });

  return {
    status: "ready",
    test: await toLevelTestView({
      bank,
      bankWrittenAt,
      goal: owned.goal,
      lastCorrect: answer.skipped ? null : answer.correct === true,
      progress: next,
    }),
  };
}
