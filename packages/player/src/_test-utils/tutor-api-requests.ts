import {
  type CreateLessonQuestionInput,
  type LessonQuestionResource,
} from "@zoonk/core/lesson-questions/contract";

/**
 * How the faked tutor API (`stubTutorApi`) reads a request's query, as the API does: a thread
 * page's scope and cursor.
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
 * A page of the thread: its scope, latest last, ending
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
  const page = inScope.slice(pageStart, pageEnd);
  const hasMore = pageStart > 0;

  return { hasMore, nextCursor: hasMore ? (page[0]?.id ?? null) : null, questions: page };
}
