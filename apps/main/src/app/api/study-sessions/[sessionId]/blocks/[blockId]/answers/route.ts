import { appPostRoute, readJsonBody } from "@/lib/http/app-post-route";
import { answerStudyQuestion } from "@zoonk/core/sessions/answer";
import { studyAnswerInputSchema } from "@zoonk/core/sessions/contract";
import { type StudyAnswerOutcome } from "@zoonk/learn/session/types";
import { z } from "zod";

const idSchema = z.uuid();

/**
 * One answer to a session question, such as a checkpoint duel's, through the same core capability
 * as `POST /v1/study-sessions/{sessionId}/blocks/{blockId}/answers`. A question answered already
 * says so, since core records each question of a block once.
 */
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
