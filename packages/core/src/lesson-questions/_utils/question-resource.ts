import "server-only";
import { type LessonQuestionGetPayload, type LessonQuestionThreadGetPayload } from "@zoonk/db";
import { changeGoalSelect, toPlanChangeView } from "../../plans/_utils/plan-change-view";
import {
  type LessonQuestionContextSummary,
  type LessonQuestionResource,
  type LessonQuestionThreadResource,
  type TutorToolOffer,
  tutorToolOfferSchema,
} from "../contract";
import { findAboutCheckedAnswer } from "./about-checked-answer";

export const lessonQuestionResourceOmit = { contextSnapshot: true } as const;

export const lessonQuestionResourceQuery = {
  include: {
    planChange: {
      include: { plan: { select: { goal: { select: changeGoalSelect }, version: true } } },
    },
  },
  omit: lessonQuestionResourceOmit,
} as const;

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
    return kind === "item" ? { answered: false, kind } : { kind };
  }

  if (!question.stepNumber) {
    throw new Error("Step-scoped lesson question is missing its immutable step number");
  }

  return { kind, stepId: question.libraryStepId, stepNumber: question.stepNumber };
}

function readToolOffer(value: unknown): TutorToolOffer | null {
  const parsed = tutorToolOfferSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function toLessonQuestionResource(
  question: LessonQuestionResourceSource,
): Promise<LessonQuestionResource> {
  const { planChange } = question;

  return {
    answer: question.answer,
    context: getContextSummary(question),
    createdAt: question.createdAt.toISOString(),
    id: question.id,
    planChange: planChange
      ? await toPlanChangeView({
          change: planChange,
          goal: planChange.plan.goal,
          planVersion: planChange.plan.version,
        })
      : null,
    question: question.question,
    status: question.status,
    toolOffer: readToolOffer(question.toolOffer),
    updatedAt: question.updatedAt.toISOString(),
  };
}

export async function toLessonQuestionThreadResource({
  hasMore,
  nextCursor,
  thread,
}: {
  hasMore: boolean;
  nextCursor: string | null;
  thread: ThreadWithQuestions;
}): Promise<LessonQuestionThreadResource> {
  return {
    hasMore,
    id: thread.id,
    lessonId: thread.libraryLessonId,
    nextCursor,
    questions: await Promise.all(
      thread.questions.map((question) => toLessonQuestionResource(question)),
    ),
  };
}

export async function markItemTurnsAnswered<Question extends LessonQuestionResource>({
  questions,
}: {
  questions: Question[];
}): Promise<Question[]> {
  const aboutAnswer = await findAboutCheckedAnswer({
    questionIds: questions
      .filter((question) => question.context.kind === "item")
      .map((question) => question.id),
  });

  return questions.map((question) =>
    question.context.kind === "item"
      ? { ...question, context: { answered: aboutAnswer.has(question.id), kind: "item" } }
      : question,
  );
}

export async function markItemTurnAnswered<Question extends LessonQuestionResource>({
  question,
}: {
  question: Question;
}): Promise<Question> {
  const [marked] = await markItemTurnsAnswered({ questions: [question] });
  return marked ?? question;
}
