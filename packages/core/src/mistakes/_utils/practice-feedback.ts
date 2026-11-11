import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { NOTHING_REACHED, type Reached } from "../../sessions/reached";
import { type MistakePracticeAnswerInput } from "../contract";
import { finishMistakePractice } from "../finish-mistake-practice";
import { type MistakePracticeFeedback } from "../practice-feedback";
import { readFixedMistakeIds } from "./practice-runs";

type PracticeRunInput = Pick<MistakePracticeAnswerInput, "run" | "timeZone">;

type AnswerFeedback = Pick<
  MistakePracticeFeedback,
  "correctAnswer" | "explanation" | "isCorrect" | "lessonResult" | "trap" | "workedSteps"
>;

export async function finishPracticeAnswer({
  answerId,
  feedback,
  input,
  mistakeId,
}: {
  answerId: string;
  feedback: AnswerFeedback;
  input: PracticeRunInput;
  mistakeId: string;
}): Promise<MistakePracticeFeedback> {
  const [saved, mistake, reached] = await Promise.all([
    prisma.attempt.findUniqueOrThrow({ where: { id: answerId } }),
    prisma.mistake.findUniqueOrThrow({ where: { id: mistakeId } }),
    countRunSoFar({ answerId, input }),
  ]);

  const fixedMistakeIds = readFixedMistakeIds(saved.answer);
  const fixed = fixedMistakeIds.includes(mistakeId);

  return {
    ...feedback,
    answerId,
    fixed,
    fixedMistakeIds,
    isCorrect: saved.isCorrect,
    mistakeStatus: fixed ? "fixed" : mistake.status,
    reached,
  };
}

async function countRunSoFar({
  answerId,
  input,
}: {
  answerId: string;
  input: PracticeRunInput;
}): Promise<Reached> {
  const { run } = input;

  if (!run) {
    return NOTHING_REACHED;
  }

  const { data, error } = await safeAsync(() =>
    finishMistakePractice({
      answerIds: [...run.answerIds, answerId],
      goalId: run.goalId,
      timeZone: input.timeZone,
    }),
  );

  if (error) {
    logError("[answerMistakePractice] Failed to count the run:", error);
  }

  return data?.status === "ready" ? data.result.reached : NOTHING_REACHED;
}
