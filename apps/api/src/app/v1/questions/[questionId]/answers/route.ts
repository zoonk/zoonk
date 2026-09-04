import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonQuestionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { trackGenerationRateLimited } from "@/lib/server-track-events";
import {
  LESSON_QUESTION_MODEL,
  type LessonQuestionAnswerCompletion,
  resolveLessonQuestionAnswerModel,
  streamLessonQuestionAnswer,
} from "@zoonk/ai/tasks/lessons/question";
import {
  claimLessonQuestionAnswer,
  completeLessonQuestionAnswer,
  failLessonQuestionAnswer,
} from "@zoonk/core/lesson-questions/answer-lifecycle";
import { logError } from "@zoonk/utils/logger";
import { consumeStream, createUIMessageStreamResponse, toUIMessageStream } from "ai";
import { after } from "next/server";

const EMPTY_ANSWER_MESSAGE = "AI provider returned an empty lesson question answer";

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

async function getLessonQuestionAnswerCompletion({
  generation,
}: {
  generation: ReturnType<typeof streamLessonQuestionAnswer>;
}): Promise<LessonQuestionAnswerCompletion> {
  const finalStep = await generation.finalStep;

  if (finalStep.finishReason === "error" || !finalStep.text.trim()) {
    throw new Error(EMPTY_ANSWER_MESSAGE);
  }

  const routedModel = resolveLessonQuestionAnswerModel({
    modelId: finalStep.response.modelId,
    provider: finalStep.model.provider,
  });

  return {
    answer: finalStep.text,
    finishReason: finalStep.finishReason,
    inputTokens: finalStep.usage.inputTokens,
    model: routedModel.model,
    outputTokens: finalStep.usage.outputTokens,
    provider: routedModel.provider,
    totalTokens: finalStep.usage.totalTokens,
  };
}

async function finishLessonQuestionAnswer({
  generation,
  questionId,
  revision,
}: {
  generation: ReturnType<typeof streamLessonQuestionAnswer>;
  questionId: string;
  revision: number;
}) {
  try {
    const completion = await getLessonQuestionAnswerCompletion({ generation });
    await persistLessonQuestionAnswer({ completion, questionId, revision });
  } catch (error) {
    logError("[Lesson Question Answer Error]", { questionId, revision });
    await failLessonQuestionAnswer({ questionId, revision });
    throw error;
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

  const generation = streamLessonQuestionAnswer({ contextSnapshot, priorTurns, question });

  const uiMessageStream = toUIMessageStream({
    onEnd: async () => {
      await finishLessonQuestionAnswer({ generation, questionId, revision });
    },
    sendReasoning: false,
    stream: generation.stream,
  });

  return createUIMessageStreamResponse({
    consumeSseStream: ({ stream }) => after(consumeStream({ stream })),
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    stream: uiMessageStream,
  });
}

export const POST = withApiErrorBoundary(createLessonQuestionAnswer);
