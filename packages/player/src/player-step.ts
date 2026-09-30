import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";

/**
 * `SerializedStep` loses some of its `kind` to `content` correlation once it moves through arrays
 * and reducer state. This guard restores that link so content narrows without assertions.
 */
function hasStepKind<Kind extends SerializedStep["kind"]>(
  step: SerializedStep,
  kind: Kind,
): step is SerializedStep<Kind> {
  return step.kind === kind;
}

/**
 * Returns the primary audio prompt for steps where listening is required.
 *
 * This intentionally excludes option-selection sounds, such as translation
 * choices and word-bank tiles, because those sounds belong to the selected
 * option rather than the step prompt that should be reachable from the bottom
 * bar.
 */
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
