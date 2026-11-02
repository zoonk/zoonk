import { type LessonStepAnswer } from "@zoonk/core/lesson-player/contract";
import { type AnswerResult } from "@zoonk/core/player/contracts/check-answer";

export type SelectedAnswer = Extract<
  LessonStepAnswer,
  {
    kind: "fillBlank" | "listening" | "matchColumns" | "multipleChoice" | "reading" | "translation";
  }
>;

export type StepResult = { answer?: SelectedAnswer; result: AnswerResult };
