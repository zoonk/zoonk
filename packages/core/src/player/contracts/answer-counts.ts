import { type AnswerResult } from "./check-answer";

/** Keeps saved attempts and completion totals on the same scoring units. */
export function getStepAnswerCounts(result: Pick<AnswerResult, "answerCounts" | "isCorrect">) {
  return (
    result.answerCounts ?? {
      correct: Number(result.isCorrect),
      incorrect: Number(!result.isCorrect),
    }
  );
}
