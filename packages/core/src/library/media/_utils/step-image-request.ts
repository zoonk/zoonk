import { type StepKind } from "@zoonk/db";
import { safeParseStepContent } from "../../steps/contract/step-contract";

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
 * The picture a screen asks for, with the words shown next to it. A screen asks
 * only when it needs one (the learner would otherwise have to imagine what it
 * shows, a question is about it, or its words point at it), so every request is
 * drawn. Screens whose content doesn't follow the contract, or that ask for no
 * picture, have none.
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
