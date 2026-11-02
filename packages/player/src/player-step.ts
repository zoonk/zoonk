import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";

function hasStepKind<Kind extends SerializedStep["kind"]>(
  step: SerializedStep,
  kind: Kind,
): step is SerializedStep<Kind> {
  return step.kind === kind;
}

export function getPlayerStepAudioUrl(step: SerializedStep): string | null {
  if (hasStepKind(step, "alphabet")) {
    return step.content.audioUrl ?? null;
  }

  if (step.kind === "listening") {
    return step.sentence?.audioUrl ?? null;
  }

  if (step.kind === "vocabulary") {
    return step.word?.audioUrl ?? null;
  }

  return null;
}
