import { appPostRoute, readJsonBody } from "@/lib/http/app-post-route";
import { mistakePracticeAnswerInputSchema } from "@zoonk/core/mistakes/contract";
import { answerMistakePractice } from "@zoonk/core/mistakes/practice-answer";
import { type MistakePracticeFeedback } from "@zoonk/learn/mistakes/practice";
import { uuidSchema } from "@zoonk/utils/uuid-schema";

const mistakeIdSchema = uuidSchema();

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

    return result.feedback;
  },
);
