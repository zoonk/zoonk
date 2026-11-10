import { type PlayableLibraryStep } from "../playable-lesson";

export function getStepSampleAnswer(step: PlayableLibraryStep): string | null {
  if (step.kind === "typedAnswer") {
    return step.content.sampleAnswer;
  }

  if (step.kind === "spokenAnswer") {
    return step.content.targetText;
  }

  if (step.kind === "check") {
    return step.content.options.find((option) => option.isCorrect)?.text ?? null;
  }

  if ("exercise" in step && step.kind === "reading") {
    return step.exercise.sentence?.sentence ?? null;
  }

  if ("exercise" in step && step.kind === "listening") {
    return step.exercise.sentence?.translation ?? null;
  }

  if ("exercise" in step && step.kind === "translation") {
    return step.exercise.word?.word ?? null;
  }

  return null;
}
