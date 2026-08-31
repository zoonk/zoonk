import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonQuestionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { trackGenerationRateLimited } from "@/lib/server-track-events";
import {
  LESSON_QUESTION_MODEL,
  type LessonQuestionAnswerCompletion,
  streamLessonQuestionAnswer,
} from "@zoonk/ai/tasks/lessons/question";
import {
  claimLessonQuestionAnswer,
  completeLessonQuestionAnswer,
  failLessonQuestionAnswer,
} from "@zoonk/core/lesson-questions/answer-lifecycle";
import { logError } from "@zoonk/utils/logger";
import { after } from "next/server";

/** Rejects the response body when the claimed revision did not accept the generated answer. */
async function persistLessonQuestionAnswer({
  completion,
  questionId,
  revision,
}: {
  completion: LessonQuestionAnswerCompletion;
  questionId: string;
  revision: number;
}) {
  const result = await completeLessonQuestionAnswer({ ...completion, questionId, revision });

  if (result.status !== "updated") {
    throw new Error(`Lesson question answer was not persisted: ${result.status}`);
  }
}

/**
 * Claims one durable turn before opening the response stream. The revision in
 * the claim prevents a late callback from overwriting a later explicit retry.
 */
async function createLessonQuestionAnswer(
  _request: Request,
  context: RouteContext<"/v1/questions/[questionId]/answers">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: lessonQuestionPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await claimLessonQuestionAnswer({
    questionId: path.data.questionId,
    requestedModel: LESSON_QUESTION_MODEL,
  });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  if (result.status === "subscriptionRequired") {
    return errors.paymentRequired();
  }

  if (result.status === "conflict") {
    return errors.conflict("Question cannot be answered in the current thread state");
  }

  if (result.status === "limitReached") {
    await trackGenerationRateLimited({
      actor: result.actor,
      limit: result.limit,
      target: { questionId: path.data.questionId },
    });

    return errors.generationLimitReached(result.limit);
  }

  const { contextSnapshot, priorTurns, question, questionId, revision } = result.claim;

  const generation = streamLessonQuestionAnswer({
    contextSnapshot,
    onEnd: async (completion) => {
      await persistLessonQuestionAnswer({ completion, questionId, revision });
    },
    onError: async () => {
      logError("[Lesson Question Answer Error]", { questionId, revision });
      await failLessonQuestionAnswer({ questionId, revision });
    },
    priorTurns,
    question,
  });

  // Register the already-started consumption with the request lifecycle so Vercel's waitUntil
  // keeps generation and persistence alive after a learner disconnects.
  after(Promise.resolve(generation.consumeStream()));

  return new Response(generation.stream.pipeThrough(new TextEncoderStream()), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const POST = withApiErrorBoundary(createLessonQuestionAnswer);
