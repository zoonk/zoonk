import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { lessonQuestionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { toClientChunks } from "@/lib/tutor-client-chunks";
import {
  type ConfirmationWords,
  confirmToolsOnly,
  loadConfirmationWords,
} from "@/lib/tutor-confirmation";
import { claimLessonQuestionAnswer } from "@zoonk/core/lesson-questions/answer-lifecycle";
import {
  LESSON_QUESTION_MEMORY_PART,
  LESSON_QUESTION_SAVED_ANSWER_PART,
} from "@zoonk/core/lesson-questions/contract";
import {
  type TutorAnswerRun,
  finishTutorAnswer,
  rememberTutorAnswer,
  startTutorAnswer,
} from "@zoonk/core/lesson-questions/tutor-answer";
import {
  type UIMessageChunk,
  consumeStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import { after } from "next/server";

const SHARED_ANSWER_ID = "answer";
const CONFIRMATION_ID = "confirmation";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, no-transform",
  "X-Content-Type-Options": "nosniff",
};

function streamSharedAnswer(answer: string) {
  return createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ id: SHARED_ANSWER_ID, type: "text-start" });
      writer.write({ delta: answer, id: SHARED_ANSWER_ID, type: "text-delta" });
      writer.write({ id: SHARED_ANSWER_ID, type: "text-end" });
    },
  });
}

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
 * `finish` is held back until the answer is saved, so it tells the client the answer is done, and
 * a failed save errors the stream before it. The saved answer then replaces what streamed: only its
 * checked links link the app.
 */
function streamGeneratedAnswer({
  run,
  words,
}: {
  run: TutorAnswerRun;
  words: ConfirmationWords | null;
}) {
  const heldBack: UIMessageChunk[] = [];
  const chunks = toUIMessageStream({ sendReasoning: false, stream: run.answer.generation.stream });

  return chunks.pipeThrough(toClientChunks(run)).pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      async flush(controller) {
        const { confirmation, saved } = await finishTutorAnswer({
          confirmation: words && confirmToolsOnly({ run, words }),
          run,
        });

        if (confirmation) {
          enqueueConfirmation({ confirmation, controller });
        }

        controller.enqueue({ data: { answer: saved }, type: LESSON_QUESTION_SAVED_ANSWER_PART });

        heldBack.forEach((chunk) => controller.enqueue(chunk));

        const memoryChanges = await rememberTutorAnswer(run.target);

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

/** The revision in the claim keeps a late callback from overwriting a later explicit retry. */
async function createLessonQuestionAnswer(
  _request: Request,
  context: RouteContext<"/v1/questions/[questionId]/answers">,
) {
  const path = await readPathParams(context, lessonQuestionPathParamsSchema);

  const result = await claimLessonQuestionAnswer({ questionId: path.questionId });

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

  const run = startTutorAnswer(result.claim);

  const words = run.confirmationLanguage
    ? await loadConfirmationWords(run.confirmationLanguage)
    : null;

  return createUIMessageStreamResponse({
    consumeSseStream: ({ stream }) => after(consumeStream({ stream })),
    headers: RESPONSE_HEADERS,
    stream: streamGeneratedAnswer({ run, words }),
  });
}

export const POST = withApiErrorBoundary(createLessonQuestionAnswer);
