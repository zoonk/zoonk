import { type GenerationQuotaLimit } from "@zoonk/core/generation-quotas/contract";
import { getGenerationLimit } from "@zoonk/core/generation-quotas/parse-limit";
import {
  type CreateLessonQuestionInput,
  type LessonQuestionResource,
  type LessonQuestionThreadResource,
  lessonQuestionResourceSchema,
  lessonQuestionThreadResponseSchema,
} from "@zoonk/core/lesson-questions/contract";
import { safeAsync } from "@zoonk/utils/error";
import { DefaultChatTransport, type UIMessageChunk } from "ai";
import { getLessonQuestionLimitRetryAt } from "./lesson-question-limit";

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
  | { kind: LessonQuestionApiErrorKind }
  | { kind: "limit"; limit: GenerationQuotaLimit; retryAt: string };

export type LessonQuestionApiResult<Value> =
  | { data: Value; status: "success" }
  | { error: LessonQuestionApiError; status: "error" };

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_PAYMENT_REQUIRED = 402;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_CONFLICT = 409;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const HTTP_STATUS_UNPROCESSABLE_ENTITY = 422;

async function getApiError(response: Response): Promise<LessonQuestionApiError> {
  if (response.status === HTTP_STATUS_UNAUTHORIZED) {
    return { kind: "authentication" };
  }

  if (response.status === HTTP_STATUS_PAYMENT_REQUIRED) {
    return { kind: "subscription" };
  }

  if (response.status === HTTP_STATUS_NOT_FOUND) {
    return { kind: "unavailable" };
  }

  if (response.status === HTTP_STATUS_CONFLICT) {
    return { kind: "conflict" };
  }

  if (response.status === HTTP_STATUS_TOO_MANY_REQUESTS) {
    const { data } = await safeAsync<unknown>(() => response.json());
    const limit = getGenerationLimit(data);

    return limit
      ? {
          kind: "limit",
          limit,
          retryAt: getLessonQuestionLimitRetryAt({ now: new Date(), period: limit.period }),
        }
      : { kind: "unknown" };
  }

  if (
    response.status === HTTP_STATUS_BAD_REQUEST ||
    response.status === HTTP_STATUS_UNPROCESSABLE_ENTITY
  ) {
    return { kind: "invalid" };
  }

  return { kind: "unknown" };
}

function lessonQuestionsUrl({
  connection,
  cursor,
  lessonId,
}: {
  connection: LessonQuestionConnection;
  cursor?: string;
  lessonId: string;
}) {
  const url = new URL(`/v1/lessons/${encodeURIComponent(lessonId)}/questions`, connection.apiUrl);

  if (cursor) {
    url.searchParams.set("cursor", cursor);
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
  cursor,
  lessonId,
}: {
  connection: LessonQuestionConnection;
  cursor?: string;
  lessonId: string;
}): Promise<LessonQuestionApiResult<LessonQuestionThreadResource | null>> {
  const { data: response, error } = await safeAsync(async () =>
    fetch(lessonQuestionsUrl({ connection, cursor, lessonId }), {
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
  lessonId,
}: {
  connection: LessonQuestionConnection;
  input: CreateLessonQuestionInput;
  lessonId: string;
}): Promise<LessonQuestionApiResult<LessonQuestionResource>> {
  const { data: response, error } = await safeAsync(async () =>
    fetch(lessonQuestionsUrl({ connection, lessonId }), {
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

async function readAnswerStream({
  onChunk,
  reader,
}: {
  onChunk: (chunk: string) => void;
  reader: ReadableStreamDefaultReader<UIMessageChunk>;
}): Promise<number> {
  const result = await reader.read();

  if (result.done) {
    return 0;
  }

  if (result.value.type === "error") {
    throw new Error(result.value.errorText);
  }

  if (result.value.type !== "text-delta") {
    return readAnswerStream({ onChunk, reader });
  }

  onChunk(result.value.delta);

  return result.value.delta.length + (await readAnswerStream({ onChunk, reader }));
}

export async function streamLessonQuestionAnswerRequest({
  connection,
  onChunk,
  questionId,
}: {
  connection: LessonQuestionConnection;
  onChunk: (chunk: string) => void;
  questionId: string;
}): Promise<LessonQuestionApiResult<null>> {
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

  const { data: characterCount, error: streamError } = await safeAsync(() =>
    readAnswerStream({ onChunk, reader: stream.getReader() }),
  );

  if (streamError || !characterCount) {
    return { error: { kind: "unknown" }, status: "error" };
  }

  return { data: null, status: "success" };
}
