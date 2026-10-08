"use server";

import {
  mistakePracticeAnswerInputSchema,
  mistakePracticeFinishInputSchema,
} from "@zoonk/core/mistakes/contract";
import { answerMistakePractice } from "@zoonk/core/mistakes/practice-answer";
import { finishMistakePractice } from "@zoonk/core/mistakes/practice-finish";
import {
  type MistakePracticeFeedback,
  type MistakePracticeSummary,
} from "@zoonk/learn/mistakes/practice";

/** Grades one practice answer through core, which records it and fixes the mistake when it sticks. */
export async function answerMistakePracticeAction({
  mistakeId,
  ...answer
}: {
  answer: unknown;
  durationMs: unknown;
  itemId: unknown;
  mistakeId: string;
  timeZone: unknown;
}): Promise<MistakePracticeFeedback> {
  const input = mistakePracticeAnswerInputSchema.safeParse(answer);

  if (!input.success) {
    return null;
  }

  const result = await answerMistakePractice({ input: input.data, mistakeId });

  if (result.status !== "ready") {
    return null;
  }

  const { feedback } = result;

  return {
    answerId: feedback.answerId,
    correctAnswer: feedback.correctAnswer,
    explanation: feedback.explanation,
    fixed: feedback.mistakeStatus === "fixed",
    isCorrect: feedback.isCorrect,
    trap: feedback.trap,
  };
}

/** Counts the run toward today through core: after each answer, and once more when it ends. */
export async function finishMistakePracticeAction(
  input: unknown,
): Promise<MistakePracticeSummary | null> {
  const parsed = mistakePracticeFinishInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const result = await finishMistakePractice(parsed.data);
  return result.status === "ready" ? result.result : null;
}
