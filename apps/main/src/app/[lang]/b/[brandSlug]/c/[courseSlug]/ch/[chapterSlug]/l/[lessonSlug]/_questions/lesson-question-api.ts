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

function questionAnswerUrl(questionId: string) {
  return new URL(`/v1/questions/${encodeURIComponent(questionId)}/answers`, API_URL).toString();
}

async function getAuthenticatedHeaders() {
  return getWorkflowAuthHeaders();
}

async function getJsonHeaders() {
  return { ...(await getAuthenticatedHeaders()), "Content-Type": "application/json" };
}

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

async function readTextStream({
  decoder,
  onChunk,
  reader,
}: {
  decoder: TextDecoder;
  onChunk: (chunk: string) => void;
  reader: ReadableStreamDefaultReader<Uint8Array>;
}): Promise<number> {
  const result = await reader.read();

  if (result.done) {
    const finalChunk = decoder.decode();

    if (finalChunk) {
      onChunk(finalChunk);
    }

    return finalChunk.length;
  }

  const chunk = decoder.decode(result.value, { stream: true });

  if (chunk) {
    onChunk(chunk);
  }

  return chunk.length + (await readTextStream({ decoder, onChunk, reader }));
}

export async function streamLessonQuestionAnswerRequest({
  onChunk,
  questionId,
}: {
  onChunk: (chunk: string) => void;
  questionId: string;
}): Promise<LessonQuestionApiResult<null>> {
  const { data: response, error } = await safeAsync(async () =>
    fetch(questionAnswerUrl(questionId), {
      cache: "no-store",
      headers: await getAuthenticatedHeaders(),
      method: "POST",
    }),
  );

  if (error || !response) {
    return { error: { kind: "unknown" }, status: "error" };
  }

  if (!response.ok) {
    return { error: await getApiError(response), status: "error" };
  }

  const body = response.body;

  if (!body) {
    return { error: { kind: "unknown" }, status: "error" };
  }

  const { data: characterCount, error: streamError } = await safeAsync(() =>
    readTextStream({ decoder: new TextDecoder(), onChunk, reader: body.getReader() }),
  );

  if (streamError || !characterCount) {
    return { error: { kind: "unknown" }, status: "error" };
  }

  return { data: null, status: "success" };
}
