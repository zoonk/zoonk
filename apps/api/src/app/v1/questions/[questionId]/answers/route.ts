import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { lessonQuestionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import {
  type AnswerGeneration,
  type AnswerRun,
  getAnswerLanguage,
  getTutorModel,
  startTutorAnswer,
  toClientChunks,
} from "@/lib/tutor-answers";
import { confirmToolsOnly, loadConfirmationWords } from "@/lib/tutor-confirmation";
import { type LessonQuestionAnswerCompletion } from "@zoonk/ai/tasks/lessons/question";
import { joinStepTexts } from "@zoonk/ai/tasks/v2/tutor/goal-tutor";
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
} from "ai";
import { after } from "next/server";

const EMPTY_ANSWER_MESSAGE = "AI provider returned an empty lesson question answer";
const SHARED_ANSWER_ID = "answer";
const CONFIRMATION_ID = "confirmation";
const RESPONSE_HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

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

/** What the answer says when the buddy only acted and wrote nothing; null otherwise. */
type Confirm = () => string | null;

/**
 * The answer with the run that wrote it: the model that actually answered and its prompt. An
 * answer whose model only acted (a card, a button) and wrote nothing says so (`confirmation`).
 */
async function getLessonQuestionAnswerCompletion({
  answer,
  confirm,
}: {
  answer: AnswerGeneration;
  confirm: Confirm;
}): Promise<{ completion: LessonQuestionAnswerCompletion; confirmation: string | null }> {
  const [finalStep, steps] = await Promise.all([
    answer.generation.finalStep,
    answer.generation.steps,
  ]);

  const failed = finalStep.finishReason === "error";
  const words = joinStepTexts(steps);
  const confirmation = failed || words ? null : confirm();
  const text = words || confirmation;

  if (failed || !text) {
    throw new Error(EMPTY_ANSWER_MESSAGE);
  }

  const provenance = await answer.provenance;

  return {
    completion: {
      answer: text,
      finishReason: finalStep.finishReason,
      generatedAt: provenance.generatedAt,
      model: provenance.model,
      promptVersion: provenance.promptVersion,
      provider: provenance.provider,
      runId: provenance.runId,
    },
    confirmation,
  };
}

/** Saves the answer and returns the confirmation it wrote for a model that only acted, if any. */
async function finishLessonQuestionAnswer({
  answer,
  confirm,
  target,
}: {
  answer: AnswerGeneration;
  confirm: Confirm;
  target: AnswerTarget;
}): Promise<string | null> {
  try {
    const { completion, confirmation } = await getLessonQuestionAnswerCompletion({
      answer,
      confirm,
    });

    await persistLessonQuestionAnswer({ completion, target });
    return confirmation;
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

/** The confirmation of an answer that only acted, sent as its words. */
function enqueueConfirmation({
  confirmation,
  controller,
}: {
  confirmation: string;
  controller: TransformStreamDefaultController<UIMessageChunk>;
}) {
  controller.enqueue({ id: CONFIRMATION_ID, type: "text-start" });
  controller.enqueue({ delta: confirmation, id: CONFIRMATION_ID, type: "text-delta" });
  controller.enqueue({ id: CONFIRMATION_ID, type: "text-end" });
}

/**
 * The answer streams as it's written. Its `finish` is held back until the answer is saved, so it
 * tells the client the answer is done: the learner can ask again while memory learns from the
 * exchange, whose changes follow as one data part for "Memory updated" with undo. A failed save
 * errors the stream before `finish`, so the client offers a retry. An answer whose model only
 * acted gets its confirmation as its words before `finish`.
 */
function streamGeneratedAnswer({
  confirm,
  run,
  target,
}: {
  confirm: Confirm;
  run: AnswerRun;
  target: AnswerTarget;
}) {
  const heldBack: UIMessageChunk[] = [];

  return run.chunks.pipeThrough(toClientChunks(run)).pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      async flush(controller) {
        const confirmation = await finishLessonQuestionAnswer({
          answer: run.answer,
          confirm,
          target,
        });

        if (confirmation) {
          enqueueConfirmation({ confirmation, controller });
        }

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
    requestedModel: getTutorModel,
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

  const { claim } = result;

  const target = {
    questionId: claim.questionId,
    revision: claim.revision,
    shareAnswer: claim.shareAnswer,
  };

  const run = startTutorAnswer(claim);
  const language = getAnswerLanguage(claim.contextSnapshot);
  const words = language ? await loadConfirmationWords(language) : null;
  const confirm = () => (words ? confirmToolsOnly({ run, words }) : null);

  return createUIMessageStreamResponse({
    consumeSseStream: ({ stream }) => after(consumeStream({ stream })),
    headers: RESPONSE_HEADERS,
    stream: streamGeneratedAnswer({ confirm, run, target }),
  });
}

export const POST = withApiErrorBoundary(createLessonQuestionAnswer);
