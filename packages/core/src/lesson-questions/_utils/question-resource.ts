import "server-only";
import { type LessonQuestion, type LessonQuestionThreadGetPayload } from "@zoonk/db";
import {
  type LessonQuestionContextSummary,
  type LessonQuestionResource,
  type LessonQuestionThreadResource,
} from "../contract";
import { parseLessonQuestionContextSnapshot } from "./context-snapshot-schema";

type ThreadWithQuestions = LessonQuestionThreadGetPayload<{ include: { questions: true } }>;

function getContextSummary(question: LessonQuestion): LessonQuestionContextSummary {
  if (question.contextKind === "lesson") {
    return { kind: "lesson" };
  }

  const snapshot = parseLessonQuestionContextSnapshot(question.contextSnapshot);

  if (!snapshot.step) {
    throw new Error("Step-scoped lesson question is missing its immutable step snapshot");
  }

  return {
    kind: question.contextKind,
    stepId: question.stepId,
    stepNumber: snapshot.step.stepNumber,
  };
}

export function toLessonQuestionResource(question: LessonQuestion): LessonQuestionResource {
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
