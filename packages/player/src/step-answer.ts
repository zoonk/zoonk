import { type LessonStepAnswer } from "@zoonk/core/lesson-player/contract";
import { type AnswerResult } from "@zoonk/core/player/contracts/check-answer";

/** What a learner answered on a language exercise, in the shape the checks grade. */
export type SelectedAnswer = Extract<
  LessonStepAnswer,
  {
    kind: "fillBlank" | "listening" | "matchColumns" | "multipleChoice" | "reading" | "translation";
  }
>;

export type StepResult = { answer?: SelectedAnswer; result: AnswerResult };
