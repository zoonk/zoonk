import {
  type CreateLessonQuestionInput,
  type GetLessonQuestionThreadInput,
  LESSON_QUESTION_MEMORY_PART,
  type LessonQuestionMemoryChange,
  type LessonQuestionResource,
  type LessonQuestionThreadResource,
  type TutorTarget,
  lessonQuestionMemoryChangesSchema,
  lessonQuestionResourceSchema,
  lessonQuestionThreadResponseSchema,
} from "@zoonk/core/lesson-questions/contract";
import { safeAsync } from "@zoonk/utils/error";
import { type UIMessageChunk } from "ai";
import {
  type LessonQuestionUsageRefusal,
  getRefusalError,
  isRefusal,
} from "./lesson-question-usage";
import { getTutorQuestionsPath } from "./tutor-questions-path";

export type LessonQuestionConnection = {
  apiUrl: string;
  getHeaders: () => Promise<Record<string, string>>;
};

type LessonQuestionApiErrorKind =
  | "authentication"
  | "subscription"
  | "unavailable"
  | "invalid"
  | "conflict"
  | "unknown";

export type LessonQuestionApiError =
  | LessonQuestionUsageRefusal
  | { kind: LessonQuestionApiErrorKind };

type LessonQuestionApiResult<Value> =
  | { data: Value; status: "success" }
  | { error: LessonQuestionApiError; status: "error" };

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_CONFLICT = 409;
const HTTP_STATUS_UNPROCESSABLE_ENTITY = 422;

async function getApiError(response: Response): Promise<LessonQuestionApiError> {
  if (response.status === HTTP_STATUS_UNAUTHORIZED) {
    return { kind: "authentication" };
  }

  if (isRefusal(response)) {
    return getRefusalError(response);
  }

  if (response.status === HTTP_STATUS_NOT_FOUND) {
    return { kind: "unavailable" };
  }

  if (response.status === HTTP_STATUS_CONFLICT) {
    return { kind: "conflict" };
  }

  if (
    response.status === HTTP_STATUS_BAD_REQUEST ||
    response.status === HTTP_STATUS_UNPROCESSABLE_ENTITY
  ) {
    return { kind: "invalid" };
  }

  return { kind: "unknown" };
}

function questionsUrl({
  connection,
  contextKind,
  cursor,
  stepId,
  target,
}: { connection: LessonQuestionConnection; target: TutorTarget } & GetLessonQuestionThreadInput) {
  const url = new URL(getTutorQuestionsPath(target), connection.apiUrl);

  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  if (stepId) {
    url.searchParams.set("stepId", stepId);
  }

  if (contextKind) {
    url.searchParams.set("contextKind", contextKind);
  }

  return url.toString();
}

function questionUrl({
  connection,
  questionId,
}: {
  connection: LessonQuestionConnection;
  questionId: string;
}) {
  return new URL(`/v1/questions/${encodeURIComponent(questionId)}`, connection.apiUrl);
}

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

async function getJsonHeaders(connection: LessonQuestionConnection) {
  return { ...(await connection.getHeaders()), "Content-Type": "application/json" };
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

export async function getLessonQuestionThreadRequest({
  connection,
  contextKind,
  cursor,
  stepId,
  target,
}: {
  connection: LessonQuestionConnection;
  target: TutorTarget;
} & GetLessonQuestionThreadInput): Promise<
  LessonQuestionApiResult<LessonQuestionThreadResource | null>
> {
  const { data: response, error } = await safeAsync(async () =>
    fetch(questionsUrl({ connection, contextKind, cursor, stepId, target }), {
      cache: "no-store",
      headers: await connection.getHeaders(),
    }),
  );

  if (error || !response) {
    return { error: { kind: "unknown" }, status: "error" };
  }

  if (!response.ok) {
    return { error: await getApiError(response), status: "error" };
  }

  const { data: body, error: bodyError } = await safeAsync<unknown>(() => response.json());
  const parsed = lessonQuestionThreadResponseSchema.safeParse(body);

  if (bodyError || !parsed.success) {
    return { error: { kind: "unknown" }, status: "error" };
  }

  return { data: parsed.data, status: "success" };
}

export async function createLessonQuestionRequest({
  connection,
  input,
  target,
}: {
  connection: LessonQuestionConnection;
  input: CreateLessonQuestionInput;
  target: TutorTarget;
}): Promise<LessonQuestionApiResult<LessonQuestionResource>> {
  const { data: response, error } = await safeAsync(async () =>
    fetch(questionsUrl({ connection, target }), {
      body: JSON.stringify(input),
      cache: "no-store",
      headers: await getJsonHeaders(connection),
      method: "POST",
    }),
  );

  if (error || !response) {
    return { error: { kind: "unknown" }, status: "error" };
  }

  if (!response.ok) {
    return { error: await getApiError(response), status: "error" };
  }

  const { data: body, error: bodyError } = await safeAsync<unknown>(() => response.json());
  const parsed = lessonQuestionResourceSchema.safeParse(body);

  if (bodyError || !parsed.success) {
    return { error: { kind: "unknown" }, status: "error" };
  }

  return { data: parsed.data, status: "success" };
}

export async function getLessonQuestionRequest({
  connection,
  questionId,
  signal,
}: {
  connection: LessonQuestionConnection;
  questionId: string;
  signal?: AbortSignal;
}): Promise<LessonQuestionApiResult<LessonQuestionResource>> {
  const { data: response, error } = await safeAsync(async () =>
    fetch(questionUrl({ connection, questionId }), {
      cache: "no-store",
      headers: await connection.getHeaders(),
      signal,
    }),
  );

  if (error || !response) {
    return { error: { kind: "unknown" }, status: "error" };
  }

  if (!response.ok) {
    return { error: await getApiError(response), status: "error" };
  }

  const { data: body, error: bodyError } = await safeAsync<unknown>(() => response.json());
  const parsed = lessonQuestionResourceSchema.safeParse(body);

  if (bodyError || !parsed.success) {
    return { error: { kind: "unknown" }, status: "error" };
  }

  return { data: parsed.data, status: "success" };
}

type AnswerStreamHandlers = {
  onChunk: (chunk: string) => void;
  onMemory: (changes: LessonQuestionMemoryChange[]) => void;
  /** The server sends `finish` once the answer is saved; memory changes may still follow. */
  onSaved: () => void;
};

/** A Library lesson's answer ends with what it changed in memory; a malformed part is ignored. */
function readMemoryPart({ chunk, onMemory }: { chunk: UIMessageChunk } & AnswerStreamHandlers) {
  if (chunk.type !== LESSON_QUESTION_MEMORY_PART || !("data" in chunk)) {
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
    readMemoryPart({ chunk: result.value, ...handlers });
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
  onSaved,
  questionId,
}: {
  connection: LessonQuestionConnection;
  onChunk: (chunk: string) => void;
  onSaved: () => void;
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
      onSaved: () => {
        saved = true;
        onSaved();
      },
      reader: stream.getReader(),
    }),
  );

  if (!saved && (streamError || !characterCount)) {
    return { error: { kind: "unknown" }, status: "error" };
  }

  return { data: { memoryChanges }, status: "success" };
}
