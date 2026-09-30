import {
  type LessonQuestionContextInput,
  type LessonQuestionScreenKind,
} from "@zoonk/core/lesson-questions/contract";

type LessonQuestionAnswerInput = Extract<LessonQuestionContextInput, { kind: "answer" }>["answer"];

/**
 * Where a question is asked from: in a player, the whole lesson, one step (by id, with its
 * position as the learner sees it) or an answer given on a step; elsewhere, a chapter, plan or
 * mock as a whole. Hosts may pass richer objects (a player passes its whole step);
 * the tutor reads only these fields.
 */
export type LessonQuestionContext =
  | { kind: "lesson" }
  | { kind: LessonQuestionScreenKind }
  | { kind: "step"; step: { id: string }; stepIndex: number }
  | {
      kind: "answer";
      selectedAnswer: LessonQuestionAnswerInput;
      step: { id: string };
      stepIndex: number;
    };
