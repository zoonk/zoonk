import {
  type CreateLessonQuestionInput,
  type GetLessonQuestionThreadInput,
  type LessonQuestionResource,
  type LessonQuestionThreadResource,
  type TutorTarget,
  lessonQuestionResourceSchema,
  lessonQuestionThreadResponseSchema,
} from "@zoonk/core/lesson-questions/contract";
import { safeAsync } from "@zoonk/utils/error";
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

export type LessonQuestionApiResult<Value> =
  | { data: Value; status: "success" }
  | { error: LessonQuestionApiError; status: "error" };

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_CONFLICT = 409;
const HTTP_STATUS_UNPROCESSABLE_ENTITY = 422;

export async function getApiError(response: Response): Promise<LessonQuestionApiError> {
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

export function questionUrl({
  connection,
  questionId,
}: {
  connection: LessonQuestionConnection;
  questionId: string;
}) {
  return new URL(`/v1/questions/${encodeURIComponent(questionId)}`, connection.apiUrl);
}

async function getJsonHeaders(connection: LessonQuestionConnection) {
  return { ...(await connection.getHeaders()), "Content-Type": "application/json" };
}

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
