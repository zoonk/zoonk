import { appPostRoute, readJsonBody } from "@/lib/http/app-post-route";
import { mistakePracticeAnswerInputSchema } from "@zoonk/core/mistakes/contract";
import { answerMistakePractice } from "@zoonk/core/mistakes/practice-answer";
import { type MistakePracticeFeedback } from "@zoonk/learn/mistakes/practice";
import { z } from "zod";

const mistakeIdSchema = z.uuid();

export const POST = appPostRoute<{ mistakeId: string }>(
  "mistakePracticeAnswerRoute",
  async (request, { mistakeId }): Promise<MistakePracticeFeedback> => {
    const input = mistakePracticeAnswerInputSchema.safeParse(await readJsonBody(request));

    if (!input.success || !mistakeIdSchema.safeParse(mistakeId).success) {
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
      fixed: feedback.fixed,
      fixedMistakeIds: feedback.fixedMistakeIds,
      isCorrect: feedback.isCorrect,
      mistakeStatus: feedback.mistakeStatus,
      reached: feedback.reached,
      trap: feedback.trap,
    };
  },
);
