import "server-only";
import { type LessonQuestionGetPayload, type LessonQuestionThreadGetPayload } from "@zoonk/db";
import { toPlanChangeView } from "../../plans/_utils/plan-change-view";
import {
  type LessonQuestionContextSummary,
  type LessonQuestionResource,
  type LessonQuestionThreadResource,
  type TutorToolOffer,
  tutorToolOfferSchema,
} from "../contract";

export const lessonQuestionResourceOmit = { contextSnapshot: true } as const;

/**
 * What a question is read with to show it: everything but its large AI snapshot, and the plan
 * change its answer proposed (with the plan's version, which says whether it can still be undone).
 */
export const lessonQuestionResourceQuery = {
  include: { planChange: { include: { plan: { select: { version: true } } } } },
  omit: lessonQuestionResourceOmit,
} as const;

/** A question as it's shown; a question read without its plan change shows none. */
export type LessonQuestionResourceSource = LessonQuestionGetPayload<{
  omit: typeof lessonQuestionResourceOmit;
}> &
  Partial<Pick<LessonQuestionGetPayload<typeof lessonQuestionResourceQuery>, "planChange">>;

type ThreadWithQuestions = LessonQuestionThreadGetPayload<{
  include: { questions: typeof lessonQuestionResourceQuery };
}>;

function getContextSummary(question: LessonQuestionResourceSource): LessonQuestionContextSummary {
  const kind = question.contextKind;

  if (kind !== "step" && kind !== "answer") {
    return { kind };
  }

  if (!question.stepNumber) {
    throw new Error("Step-scoped lesson question is missing its immutable step number");
  }

  return { kind, stepId: question.libraryStepId, stepNumber: question.stepNumber };
}

/** The app tool the answer offered, as saved with it; none when unreadable. */
function readToolOffer(value: unknown): TutorToolOffer | null {
  const parsed = tutorToolOfferSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function toLessonQuestionResource(
  question: LessonQuestionResourceSource,
): LessonQuestionResource {
  const { planChange } = question;

  return {
    answer: question.answer,
    context: getContextSummary(question),
    createdAt: question.createdAt.toISOString(),
    id: question.id,
    planChange: planChange
      ? toPlanChangeView({ change: planChange, planVersion: planChange.plan.version })
      : null,
    question: question.question,
    status: question.status,
    toolOffer: readToolOffer(question.toolOffer),
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
    lessonId: thread.libraryLessonId,
    nextCursor,
    questions: thread.questions.map((question) => toLessonQuestionResource(question)),
  };
}
