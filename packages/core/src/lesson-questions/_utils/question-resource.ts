import "server-only";
import { type LessonQuestionGetPayload, type LessonQuestionThreadGetPayload } from "@zoonk/db";
import {
  type LessonQuestionContextSummary,
  type LessonQuestionResource,
  type LessonQuestionThreadResource,
} from "../contract";

export const lessonQuestionResourceOmit = { contextSnapshot: true } as const;

export type LessonQuestionResourceSource = LessonQuestionGetPayload<{
  omit: typeof lessonQuestionResourceOmit;
}>;

type ThreadWithQuestions = LessonQuestionThreadGetPayload<{
  include: { questions: { omit: typeof lessonQuestionResourceOmit } };
}>;

function getContextSummary(question: LessonQuestionResourceSource): LessonQuestionContextSummary {
  if (question.contextKind === "lesson") {
    return { kind: "lesson" };
  }

  if (!question.stepNumber) {
    throw new Error("Step-scoped lesson question is missing its immutable step number");
  }

  return { kind: question.contextKind, stepId: question.stepId, stepNumber: question.stepNumber };
}

export function toLessonQuestionResource(
  question: LessonQuestionResourceSource,
): LessonQuestionResource {
  return {
    answer: question.answer,
    context: getContextSummary(question),
    createdAt: question.createdAt.toISOString(),
    id: question.id,
    question: question.question,
    status: question.status,
    updatedAt: question.updatedAt.toISOString(),
  };
}

export function toLessonQuestionThreadResource({
  hasMore,
  nextCursor,
  thread,
}: {
  hasMore: boolean;
  nextCursor: string | null;
  thread: ThreadWithQuestions;
}): LessonQuestionThreadResource {
  return {
    hasMore,
    id: thread.id,
    lessonId: thread.lessonId,
    nextCursor,
    questions: thread.questions.map((question) => toLessonQuestionResource(question)),
  };
}
