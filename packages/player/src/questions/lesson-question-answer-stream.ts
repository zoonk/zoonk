import {
  LESSON_QUESTION_MEMORY_PART,
  LESSON_QUESTION_PLAN_CHANGE_PART,
  LESSON_QUESTION_REPLACED_CHANGES_PART,
  LESSON_QUESTION_TOOL_OFFER_PART,
  type LessonQuestionMemoryChange,
  type TutorToolOffer,
  lessonQuestionMemoryChangesSchema,
  replacedPlanChangesSchema,
  tutorToolOfferSchema,
} from "@zoonk/core/lesson-questions/contract";
import { planChangeSchema } from "@zoonk/core/plans/change-contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { safeAsync } from "@zoonk/utils/error";
import { type UIMessageChunk } from "ai";
import {
  type LessonQuestionApiError,
  type LessonQuestionApiResult,
  type LessonQuestionConnection,
  getApiError,
  questionUrl,
} from "./lesson-question-api";

function questionAnswerUrl({
  connection,
  questionId,
}: {
  connection: LessonQuestionConnection;
  questionId: string;
}) {
  return new URL(
    `${questionUrl({ connection, questionId }).pathname}/answers`,
    connection.apiUrl,
  ).toString();
}

class LessonQuestionAnswerRequestError extends Error {
  readonly apiError: LessonQuestionApiError;

  constructor(apiError: LessonQuestionApiError) {
    super("Lesson question answer request failed");
    this.apiError = apiError;
    this.name = "LessonQuestionAnswerRequestError";
  }
}

const fetchLessonQuestionAnswer: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new LessonQuestionAnswerRequestError(await getApiError(response));
  }

  return response;
};

type AnswerStreamHandlers = {
  onChunk: (chunk: string) => void;
  onMemory: (changes: LessonQuestionMemoryChange[]) => void;
  /** The buddy proposed a plan change in this answer, waiting for the learner's tap. */
  onPlanChange: (change: PlanChangeView) => void;
  /** Earlier proposals of the conversation the new one replaced. */
  onPlanChangesReplaced: (changeIds: string[]) => void;
  /** The buddy offered one of the app's tools in this answer. */
  onToolOffer: (offer: TutorToolOffer) => void;
  /** The server sends `finish` once the answer is saved; memory changes may still follow. */
  onSaved: () => void;
};

/**
 * An answer may carry a plan change it proposed, an app tool it offered and, at its end, what it
 * changed in memory; a malformed part is ignored.
 */
function readDataPart({
  chunk,
  onMemory,
  onPlanChange,
  onPlanChangesReplaced,
  onToolOffer,
}: { chunk: UIMessageChunk } & AnswerStreamHandlers) {
  if (!("data" in chunk)) {
    return;
  }

  if (chunk.type === LESSON_QUESTION_REPLACED_CHANGES_PART) {
    const replaced = replacedPlanChangesSchema.safeParse(chunk.data);

    if (replaced.success) {
      onPlanChangesReplaced(replaced.data.ids);
    }

    return;
  }

  if (chunk.type === LESSON_QUESTION_TOOL_OFFER_PART) {
    const offer = tutorToolOfferSchema.safeParse(chunk.data);

    if (offer.success) {
      onToolOffer(offer.data);
    }

    return;
  }

  if (chunk.type === LESSON_QUESTION_PLAN_CHANGE_PART) {
    const change = planChangeSchema.safeParse(chunk.data);

    if (change.success) {
      onPlanChange(change.data);
    }

    return;
  }

  if (chunk.type !== LESSON_QUESTION_MEMORY_PART) {
    return;
  }

  const parsed = lessonQuestionMemoryChangesSchema.safeParse(chunk.data);

  if (parsed.success) {
    onMemory(parsed.data);
  }
}

async function readAnswerStream({
  reader,
  ...handlers
}: AnswerStreamHandlers & {
  reader: ReadableStreamDefaultReader<UIMessageChunk>;
}): Promise<number> {
  const result = await reader.read();

  if (result.done) {
    return 0;
  }

  if (result.value.type === "error") {
    throw new Error(result.value.errorText);
  }

  if (result.value.type === "finish") {
    handlers.onSaved();
  }

  if (result.value.type !== "text-delta") {
    readDataPart({ chunk: result.value, ...handlers });
    return readAnswerStream({ reader, ...handlers });
  }

  handlers.onChunk(result.value.delta);

  return result.value.delta.length + (await readAnswerStream({ reader, ...handlers }));
}

/**
 * Streams a tutor answer. `onSaved` runs as soon as the server saved the answer, before what the
 * exchange taught memory arrives, so the learner can ask again at once; a stream cut after that
 * still counts as answered.
 */
export async function streamLessonQuestionAnswerRequest({
  connection,
  onChunk,
  onPlanChange,
  onPlanChangesReplaced,
  onSaved,
  onToolOffer,
  questionId,
}: {
  connection: LessonQuestionConnection;
  onChunk: (chunk: string) => void;
  onPlanChange: (change: PlanChangeView) => void;
  onPlanChangesReplaced: (changeIds: string[]) => void;
  onSaved: () => void;
  onToolOffer: (offer: TutorToolOffer) => void;
  questionId: string;
}): Promise<LessonQuestionApiResult<{ memoryChanges: LessonQuestionMemoryChange[] }>> {
  // The AI SDK's client (and the schemas it brings) loads when the learner asks, not with every lesson.
  const { DefaultChatTransport } = await import("ai");

  const transport = new DefaultChatTransport({
    api: questionAnswerUrl({ connection, questionId }),
    fetch: fetchLessonQuestionAnswer,
    headers: connection.getHeaders,
  });

  const { data: stream, error } = await safeAsync(() =>
    transport.sendMessages({
      abortSignal: undefined,
      chatId: questionId,
      messageId: undefined,
      messages: [],
      trigger: "submit-message",
    }),
  );

  if (error instanceof LessonQuestionAnswerRequestError) {
    return { error: error.apiError, status: "error" };
  }

  if (error || !stream) {
    return { error: { kind: "unknown" }, status: "error" };
  }

  let memoryChanges: LessonQuestionMemoryChange[] = [];
  let saved = false;

  const { data: characterCount, error: streamError } = await safeAsync(() =>
    readAnswerStream({
      onChunk,
      onMemory: (changes) => {
        memoryChanges = changes;
      },
      onPlanChange,
      onPlanChangesReplaced,
      onSaved: () => {
        saved = true;
        onSaved();
      },
      onToolOffer,
      reader: stream.getReader(),
    }),
  );

  if (!saved && (streamError || !characterCount)) {
    return { error: { kind: "unknown" }, status: "error" };
  }

  return { data: { memoryChanges }, status: "success" };
}
