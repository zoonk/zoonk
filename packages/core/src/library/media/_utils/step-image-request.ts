import { type StepKind } from "@zoonk/db";
import { safeParseStepContent } from "../../steps/contract/step-contract";

/**
 * "At most one every 2 or 3 screens": two pictures are always at least this
 * many screens apart, even when the writer asked for more.
 */
const MIN_SCREENS_BETWEEN_IMAGES = 2;

/** The screen fields a picture sits next to, in reading order. */
const SCREEN_TEXT_FIELDS = [
  "title",
  "question",
  "prompt",
  "context",
  "problem",
  "text",
  "reveal",
] as const;

export type StepImageRequest = { prompt: string; alt: string; screenText: string };

function getScreenText(content: Record<string, unknown>): string {
  return SCREEN_TEXT_FIELDS.map((field) => content[field])
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}

/**
 * The picture a screen asks for, with the words shown next to it. Screens
 * whose content doesn't follow the contract, or that ask for no picture, have
 * none.
 */
export function getStepImageRequest({
  content,
  kind,
}: {
  content: unknown;
  kind: StepKind;
}): StepImageRequest | null {
  const parsed = safeParseStepContent(kind, content);

  if (!parsed.success || !("image" in parsed.data)) {
    return null;
  }

  const { image } = parsed.data;

  // Language kinds store an image with a URL; teaching and activity screens request a new picture.
  if (!image || !("alt" in image)) {
    return null;
  }

  return { alt: image.alt, prompt: image.prompt, screenText: getScreenText(parsed.data) };
}

function keepIfSpaced<TStep extends { position: number }>(kept: TStep[], step: TStep): TStep[] {
  const last = kept.at(-1);
  const isFarEnough = !last || step.position - last.position >= MIN_SCREENS_BETWEEN_IMAGES;
  return isFarEnough ? [...kept, step] : kept;
}

/**
 * Picks which requested pictures to draw: in screen order, a picture is kept
 * only when the last kept one is at least two screens back, so a lesson never
 * shows pictures on consecutive screens.
 */
export function pickSpacedImageSteps<TStep extends { position: number }>(
  steps: readonly TStep[],
): TStep[] {
  return steps
    .toSorted((first, second) => first.position - second.position)
    .reduce<TStep[]>((kept, step) => keepIfSpaced(kept, step), []);
}
