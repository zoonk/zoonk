import { appPostRoute, readJsonBody } from "@/lib/http/app-post-route";
import { answerStudyQuestion } from "@zoonk/core/sessions/answer";
import { studyAnswerInputSchema } from "@zoonk/core/sessions/contract";
import { type StudyAnswerOutcome } from "@zoonk/learn/session/types";
import { z } from "zod";

const idSchema = z.uuid();

export const POST = appPostRoute<{ blockId: string; sessionId: string }>(
  "studyAnswerRoute",
  async (request, { blockId, sessionId }): Promise<StudyAnswerOutcome> => {
    const input = studyAnswerInputSchema.safeParse(await readJsonBody(request));

    if (
      !input.success ||
      !idSchema.safeParse(blockId).success ||
      !idSchema.safeParse(sessionId).success
    ) {
      return { status: "failed" };
    }

    const result = await answerStudyQuestion({ blockId, input: input.data, sessionId });

    if (result.status === "ready") {
      return { feedback: result.feedback, status: "answered" };
    }

    return result.status === "alreadyAnswered" || result.status === "blockNotActive"
      ? result
      : { status: "failed" };
  },
);
