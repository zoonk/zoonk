import {
  type LessonQuestionContextInput,
  type LessonQuestionContextSummary,
  type LessonQuestionScreenKind,
} from "@zoonk/core/lesson-questions/contract";

type LessonQuestionAnswerInput = Extract<LessonQuestionContextInput, { kind: "answer" }>["answer"];

/**
 * Where a question is asked from: in a player, the whole lesson, one step (by id, with its
 * position as the learner sees it) or an answer given on a step; elsewhere, a chapter, plan,
 * subject or mock as a whole, or a session's or practice's question (`item`: which one, whether
 * it was checked, and the session block it's asked in). Hosts may pass richer objects (a player passes its whole step);
 * the tutor reads only these fields.
 */
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

/**
 * Asked about an answer the learner checked, so the tutor saw it and the right one: a lesson
 * screen's answer, or a session's or practice's question once it's checked (`answered`, which a
 * saved turn keeps too).
 */
export function isAboutCheckedAnswer(
  context: LessonQuestionContext | LessonQuestionContextSummary,
): boolean {
  return context.kind === "answer" || (context.kind === "item" && context.answered);
}
