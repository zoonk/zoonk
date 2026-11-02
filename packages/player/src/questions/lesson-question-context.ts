import {
  type LessonQuestionContextInput,
  type LessonQuestionContextSummary,
  type LessonQuestionScreenKind,
} from "@zoonk/core/lesson-questions/contract";

type LessonQuestionAnswerInput = Extract<LessonQuestionContextInput, { kind: "answer" }>["answer"];

export type LessonQuestionContext =
  | { kind: "lesson" }
  | { answered: boolean; blockId: string | null; itemId: string; kind: "item" }
  | { kind: LessonQuestionScreenKind }
  | { kind: "step"; step: { id: string }; stepIndex: number }
  | {
      kind: "answer";
      selectedAnswer: LessonQuestionAnswerInput;
      step: { id: string };
      stepIndex: number;
    };

export function isAboutCheckedAnswer(
  context: LessonQuestionContext | LessonQuestionContextSummary,
): boolean {
  return context.kind === "answer" || (context.kind === "item" && context.answered);
}
