import {
  type CreateLessonQuestionInput,
  type LessonQuestionResource,
} from "@zoonk/core/lesson-questions/contract";

/**
 * How the faked tutor API (`stubTutorApi`) reads a request's query, as the API does: a thread
 * page's scope and cursor, and whether an item turn says it was about the learner's checked answer
 * (`include=answered`), or, as the API from before `include`, refuses it.
 */

function isInScope({ question, url }: { question: LessonQuestionResource; url: URL }) {
  const stepId = url.searchParams.get("stepId");
  const contextKind = url.searchParams.get("contextKind");

  if (stepId && (!("stepId" in question.context) || question.context.stepId !== stepId)) {
    return false;
  }

  return !contextKind || question.context.kind === contextKind;
}

export function getContextSummary(
  context: CreateLessonQuestionInput["context"],
): LessonQuestionResource["context"] {
  if (context.kind === "item") {
    return { answered: context.answered, kind: context.kind };
  }

  if (context.kind !== "step" && context.kind !== "answer") {
    return { kind: context.kind };
  }

  return { kind: context.kind, stepId: context.stepId, stepNumber: context.stepNumber };
}

/**
 * A question as a request reads it: like the API, a turn about a session's or practice's question
 * says whether it was about the learner's checked answer only when the request asks for it.
 */
export function asRequested({ question, url }: { question: LessonQuestionResource; url: URL }) {
  if (question.context.kind !== "item" || url.searchParams.get("include") === "answered") {
    return question;
  }

  return { ...question, context: { kind: question.context.kind } };
}

/**
 * A page of the thread as the request reads it (`asRequested`): its scope, latest last, ending
 * before `cursor` (an older page) when there's one.
 */
export function getThreadPage({
  pageSize,
  questions,
  url,
}: {
  pageSize: number | undefined;
  questions: LessonQuestionResource[];
  url: URL;
}) {
  const inScope = questions.filter((question) => isInScope({ question, url }));
  const cursor = url.searchParams.get("cursor");
  const cursorIndex = cursor ? inScope.findIndex((question) => question.id === cursor) : -1;
  const pageEnd = cursorIndex >= 0 ? cursorIndex : inScope.length;
  const pageStart = pageSize ? Math.max(0, pageEnd - pageSize) : 0;
  const page = inScope.slice(pageStart, pageEnd).map((question) => asRequested({ question, url }));
  const hasMore = pageStart > 0;

  return { hasMore, nextCursor: hasMore ? (page[0]?.id ?? null) : null, questions: page };
}

/**
 * A request as the API from before `include` takes it, as apps can meet it while they deploy: a
 * thread read's strict query refuses it (null), and a question or a new one reads as if it weren't
 * there.
 */
export function asOlderApiRequest(request: Request): Request | null {
  const url = new URL(request.url);

  if (!url.searchParams.has("include")) {
    return request;
  }

  if (request.method === "GET" && url.pathname.endsWith("/questions")) {
    return null;
  }

  url.searchParams.delete("include");
  return new Request(url, request);
}
