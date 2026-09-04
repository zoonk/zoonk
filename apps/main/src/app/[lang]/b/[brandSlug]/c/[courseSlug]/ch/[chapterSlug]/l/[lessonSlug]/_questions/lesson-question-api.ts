import { getGenerationLimit } from "@/lib/workflow/_utils/generation-limit";
import { getWorkflowAuthHeaders } from "@/lib/workflow/auth-headers";
import { type GenerationQuotaLimit } from "@zoonk/core/generation-quotas/contract";
import {
  type CreateLessonQuestionInput,
  type LessonQuestionResource,
  type LessonQuestionThreadResource,
  lessonQuestionResourceSchema,
  lessonQuestionThreadResponseSchema,
} from "@zoonk/core/lesson-questions/contract";
import { safeAsync } from "@zoonk/utils/error";
import { API_URL } from "@zoonk/utils/url";
import { DefaultChatTransport, type UIMessageChunk } from "ai";
import { getLessonQuestionLimitRetryAt } from "./lesson-question-limit";

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

function lessonQuestionsUrl({ cursor, lessonId }: { cursor?: string; lessonId: string }) {
  const url = new URL(`/v1/lessons/${encodeURIComponent(lessonId)}/questions`, API_URL);

  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  return url.toString();
}

function questionUrl(questionId: string) {
  return new URL(`/v1/questions/${encodeURIComponent(questionId)}`, API_URL);
}

function questionAnswerUrl(questionId: string) {
  return new URL(`${questionUrl(questionId).pathname}/answers`, API_URL).toString();
}

async function getAuthenticatedHeaders() {
  return getWorkflowAuthHeaders();
}

async function getJsonHeaders() {
  return { ...(await getAuthenticatedHeaders()), "Content-Type": "application/json" };
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
  cursor,
  lessonId,
}: {
  cursor?: string;
  lessonId: string;
}): Promise<LessonQuestionApiResult<LessonQuestionThreadResource | null>> {
  const { data: response, error } = await safeAsync(async () =>
    fetch(lessonQuestionsUrl({ cursor, lessonId }), {
      cache: "no-store",
      headers: await getAuthenticatedHeaders(),
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
  input,
  lessonId,
}: {
  input: CreateLessonQuestionInput;
  lessonId: string;
}): Promise<LessonQuestionApiResult<LessonQuestionResource>> {
  const { data: response, error } = await safeAsync(async () =>
    fetch(lessonQuestionsUrl({ lessonId }), {
      body: JSON.stringify(input),
      cache: "no-store",
      headers: await getJsonHeaders(),
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
  questionId,
  signal,
}: {
  questionId: string;
  signal?: AbortSignal;
}): Promise<LessonQuestionApiResult<LessonQuestionResource>> {
  const { data: response, error } = await safeAsync(async () =>
    fetch(questionUrl(questionId), {
      cache: "no-store",
      headers: await getAuthenticatedHeaders(),
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
  onChunk,
  questionId,
}: {
  onChunk: (chunk: string) => void;
  questionId: string;
}): Promise<LessonQuestionApiResult<null>> {
  const transport = new DefaultChatTransport({
    api: questionAnswerUrl(questionId),
    fetch: fetchLessonQuestionAnswer,
    headers: getAuthenticatedHeaders,
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
