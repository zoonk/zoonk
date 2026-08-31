import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type PlayerQuestionContext } from "../player-context";
import { type PlayerPhase, type SelectedAnswer, type StepResult } from "../player-reducer";

export function getHeaderQuestionContext({
  phase,
  step,
  stepIndex,
}: {
  phase: PlayerPhase;
  step: SerializedStep;
  stepIndex: number;
}): PlayerQuestionContext | null {
  if (phase !== "playing") {
    return null;
  }

  return { kind: "step", step, stepIndex };
}

export function getAnswerQuestionContext({
  phase,
  result,
  selectedAnswer,
  step,
  stepIndex,
}: {
  phase: PlayerPhase;
  result?: StepResult;
  selectedAnswer?: SelectedAnswer;
  step: SerializedStep;
  stepIndex: number;
}): PlayerQuestionContext | null {
  const isAnsweredFeedback = phase === "feedback" && result && selectedAnswer;

  if (!isAnsweredFeedback) {
    return null;
  }

  return { kind: "answer", result, selectedAnswer, step, stepIndex };
}
