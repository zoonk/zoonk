import {
  type LessonQuestionContextInput,
  type LessonQuestionContextSummary,
  type LessonQuestionScreenKind,
} from "@zoonk/core/lesson-questions/contract";

type LessonQuestionAnswerInput = Extract<LessonQuestionContextInput, { kind: "answer" }>["answer"];

export type LessonQuestionContext = (
  | { kind: "lesson" }
  | { answered: boolean; blockId: string | null; itemId: string; kind: "item" }
  | { kind: LessonQuestionScreenKind }
  | { kind: "step"; step: { id: string }; stepIndex: number }
  | {
      kind: "answer";
      selectedAnswer: LessonQuestionAnswerInput;
      step: { id: string };
      stepIndex: number;
    }
) & { mistakeId?: string };

export function isAboutCheckedAnswer(
  context: LessonQuestionContext | LessonQuestionContextSummary,
): boolean {
  return context.kind === "answer" || (context.kind === "item" && context.answered);
}

type Topic = LessonQuestionContext | LessonQuestionContextSummary;

function getTopicKey(context: Topic): string {
  if (context.kind === "item") {
    return `item:${context.answered}`;
  }

  if (context.kind === "step" || context.kind === "answer") {
    return `${context.kind}:${"step" in context ? context.step.id : context.stepId}`;
  }

  return context.kind;
}

/** A question's topic is named where it changes: another part, or the answer once it's checked. */
export function isSameTopic(previous: Topic | null, next: Topic): boolean {
  return previous !== null && getTopicKey(previous) === getTopicKey(next);
}
