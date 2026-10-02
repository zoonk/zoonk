import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { lessonQuestionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import {
  LESSON_QUESTION_MODEL,
  type LessonQuestionAnswerCompletion,
  streamLessonQuestionAnswer,
} from "@zoonk/ai/tasks/lessons/question";
import {
  claimLessonQuestionAnswer,
  completeLessonQuestionAnswer,
  failLessonQuestionAnswer,
  rememberLessonQuestionAnswer,
} from "@zoonk/core/lesson-questions/answer-lifecycle";
import { LESSON_QUESTION_MEMORY_PART } from "@zoonk/core/lesson-questions/contract";
import { type MemoryChange } from "@zoonk/core/memory/contract";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import {
  type UIMessageChunk,
  consumeStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import { after } from "next/server";

const EMPTY_ANSWER_MESSAGE = "AI provider returned an empty lesson question answer";
const SHARED_ANSWER_ID = "answer";
const RESPONSE_HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

type AnswerGeneration = ReturnType<typeof streamLessonQuestionAnswer>;

type AnswerTarget = { questionId: string; revision: number; shareAnswer: boolean };

/** Rejects the response body when the claimed revision did not accept the generated answer. */
async function persistLessonQuestionAnswer({
  completion,
  target,
}: {
  completion: LessonQuestionAnswerCompletion;
  target: AnswerTarget;
}): Promise<void> {
  const result = await completeLessonQuestionAnswer({ ...completion, ...target });

  if (result.status !== "updated") {
    throw new Error(`Lesson question answer was not persisted: ${result.status}`);
  }
}

/** The answer with the run that wrote it: the model that actually answered and its prompt. */
async function getLessonQuestionAnswerCompletion(
  answer: AnswerGeneration,
): Promise<LessonQuestionAnswerCompletion> {
  const finalStep = await answer.generation.finalStep;

  if (finalStep.finishReason === "error" || !finalStep.text.trim()) {
    throw new Error(EMPTY_ANSWER_MESSAGE);
  }

  const provenance = await answer.provenance;

  return {
    answer: finalStep.text,
    finishReason: finalStep.finishReason,
    generatedAt: provenance.generatedAt,
    inputTokens: finalStep.usage.inputTokens,
    model: provenance.model,
    outputTokens: finalStep.usage.outputTokens,
    promptVersion: provenance.promptVersion,
    provider: provenance.provider,
    runId: provenance.runId,
    totalTokens: finalStep.usage.totalTokens,
  };
}

async function finishLessonQuestionAnswer({
  answer,
  target,
}: {
  answer: AnswerGeneration;
  target: AnswerTarget;
}): Promise<void> {
  try {
    const completion = await getLessonQuestionAnswerCompletion(answer);
    await persistLessonQuestionAnswer({ completion, target });
  } catch (error) {
    logError("[Lesson Question Answer Error]", {
      questionId: target.questionId,
      revision: target.revision,
    });

    await failLessonQuestionAnswer({ questionId: target.questionId, revision: target.revision });
    throw error;
  }
}

/**
 * Someone already asked this on the same screen: the saved answer goes out through the same UI
 * message stream a generated one does, so clients read both the same way.
 */
function streamSharedAnswer(answer: string) {
  return createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ id: SHARED_ANSWER_ID, type: "text-start" });
      writer.write({ delta: answer, id: SHARED_ANSWER_ID, type: "text-delta" });
      writer.write({ id: SHARED_ANSWER_ID, type: "text-end" });
    },
  });
}

/**
 * What a personal exchange taught the learner's memory, learned once the answer is saved. The
 * answer is already done then, so a failure here is logged and changes nothing.
 */
async function learnFromAnswer(target: AnswerTarget): Promise<MemoryChange[]> {
  if (target.shareAnswer) {
    return [];
  }

  const { data, error } = await safeAsync(() =>
    rememberLessonQuestionAnswer({ questionId: target.questionId }),
  );

  if (error) {
    logError("[Lesson Question Memory Error]", { questionId: target.questionId });
    return [];
  }

  return data;
}

/**
 * The answer streams as it's written. Its `finish` is held back until the answer is saved, so it
 * tells the client the answer is done: the learner can ask again while memory learns from the
 * exchange, whose changes follow as one data part for "Memory updated" with undo. A failed save
 * errors the stream before `finish`, so the client offers a retry.
 */
function streamGeneratedAnswer({
  answer,
  target,
}: {
  answer: AnswerGeneration;
  target: AnswerTarget;
}) {
  const heldBack: UIMessageChunk[] = [];

  return toUIMessageStream({ sendReasoning: false, stream: answer.generation.stream }).pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      async flush(controller) {
        await finishLessonQuestionAnswer({ answer, target });
        heldBack.forEach((chunk) => controller.enqueue(chunk));

        const memoryChanges = await learnFromAnswer(target);

        if (memoryChanges.length > 0) {
          controller.enqueue({ data: memoryChanges, type: LESSON_QUESTION_MEMORY_PART });
        }
      },
      transform(chunk, controller) {
        if (chunk.type === "finish") {
          heldBack.push(chunk);
          return;
        }

        controller.enqueue(chunk);
      },
    }),
  );
}

/**
 * Claims one durable turn before opening the response stream. The revision in the claim prevents
 * a late callback from overwriting a later explicit retry.
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

  if (result.status === "conflict") {
    return errors.conflict("Question cannot be answered in the current thread state");
  }

  if (result.status === "usageRefused") {
    return usageDecisionError(result.decision);
  }

  if (result.status === "shared") {
    return createUIMessageStreamResponse({
      headers: RESPONSE_HEADERS,
      stream: streamSharedAnswer(result.answer),
    });
  }

  const {
    contextSnapshot,
    learnerMemory,
    priorTurns,
    question,
    questionId,
    revision,
    shareAnswer,
  } = result.claim;

  const answer = streamLessonQuestionAnswer({
    analytics: { contentScope: shareAnswer ? "shared" : "personal" },
    contextSnapshot,
    learnerMemory,
    priorTurns,
    question,
  });

  return createUIMessageStreamResponse({
    consumeSseStream: ({ stream }) => after(consumeStream({ stream })),
    headers: RESPONSE_HEADERS,
    stream: streamGeneratedAnswer({ answer, target: { questionId, revision, shareAnswer } }),
  });
}

export const POST = withApiErrorBoundary(createLessonQuestionAnswer);
