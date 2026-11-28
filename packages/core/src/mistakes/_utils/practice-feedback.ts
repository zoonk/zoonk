import "server-only";
import { type Attempt } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isJsonObject } from "@zoonk/utils/json";
import { logError } from "@zoonk/utils/logger";
import { NOTHING_REACHED, type Reached } from "../../sessions/reached";
import { type MistakePracticeAnswerInput } from "../contract";
import { finishMistakePractice } from "../finish-mistake-practice";
import { type MistakePracticeFeedback, mistakePracticeFeedbackSchema } from "../practice-feedback";
import { readFixedMistakeIds } from "./practice-runs";

type PracticeRunInput = Pick<MistakePracticeAnswerInput, "run" | "timeZone">;

const answerFeedbackSchema = mistakePracticeFeedbackSchema.pick({
  correctAnswer: true,
  explanation: true,
  lessonResult: true,
  trap: true,
  workedSteps: true,
});

type AnswerFeedback = Pick<
  MistakePracticeFeedback,
  "correctAnswer" | "explanation" | "lessonResult" | "trap" | "workedSteps"
>;

export function readPracticeFeedback(attempt: Attempt): AnswerFeedback | null {
  const stored = isJsonObject(attempt.answer) ? attempt.answer.practiceFeedback : null;
  const parsed = answerFeedbackSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

export async function finishPracticeAnswer({
  attempt,
  feedback,
  input,
  mistakeId,
}: {
  attempt: Attempt;
  feedback: AnswerFeedback;
  input: PracticeRunInput;
  mistakeId: string;
}): Promise<MistakePracticeFeedback & { answerId: string }> {
  const fixedMistakeIds = readFixedMistakeIds(attempt.answer);
  const fixed = fixedMistakeIds.includes(mistakeId);
  const isCorrect = attempt.isCorrect;

  return {
    ...(readPracticeFeedback(attempt) ?? feedback),
    answerId: attempt.id,
    fixed,
    fixedMistakeIds,
    isCorrect,
    mistakeStatus: fixed ? "fixed" : "open",
    reached: await countRunSoFar({ answerId: attempt.id, input }),
    requiresLaterDay: isCorrect && !fixed,
  };
}

export async function countRunSoFar({
  answerId,
  input,
}: {
  answerId?: string;
  input: PracticeRunInput;
}): Promise<Reached> {
  const { run } = input;

  if (!run) {
    return NOTHING_REACHED;
  }

  const { data, error } = await safeAsync(() =>
    finishMistakePractice({
      answerIds: answerId ? [...run.answerIds, answerId] : run.answerIds,
      blockId: run.blockId,
      goalId: run.goalId,
      mockId: run.mockId,
      timeZone: input.timeZone,
    }),
  );

  if (error) {
    logError("[answerMistakePractice] Failed to count the run:", error);
  }

  return data?.status === "ready" ? data.result.reached : NOTHING_REACHED;
}
