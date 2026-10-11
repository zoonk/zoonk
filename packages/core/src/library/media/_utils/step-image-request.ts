import { type StepKind } from "@zoonk/db";
import { labeledPictureRequest } from "../../activities/templates/labeled-diagram";
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

/**
 * A picture a screen asks for. `parts` are the parts its numbers mark, in order, for a picture
 * whose numbers the screen asks about (a labeled diagram, "which number is the left ventricle?").
 */
export type StepImageRequest = {
  alt: string;
  parts: readonly string[] | null;
  prompt: string;
  screenText: string;
};

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

  if (!parsed.success) {
    return null;
  }

  const labeled = labeledDiagramFields({ content, kind });

  if (labeled) {
    const request = labeledPictureRequest(labeled);
    return { ...request, screenText: getScreenText(parsed.data) };
  }

  const image = "image" in parsed.data ? parsed.data.image : null;

  // Language kinds store an image with a URL; teaching and activity screens request a new picture.
  if (!image || !("alt" in image)) {
    return null;
  }

  return {
    alt: image.alt,
    parts: "parts" in image ? (image.parts ?? null) : null,
    prompt: image.prompt,
    screenText: getScreenText(parsed.data),
  };
}

/**
 * The labeled diagram a screen shows, if any: an activity screen's own, or one an explanation
 * shows to explore. Its picture is the screen's picture, numbered from its parts.
 */
function labeledDiagramFields({ content, kind }: { content: unknown; kind: StepKind }) {
  if (kind === "activity") {
    const parsed = safeParseStepContent("activity", content);
    return parsed.success && parsed.data.template === "labeledDiagram" ? parsed.data.fields : null;
  }

  if (kind === "explanation") {
    const parsed = safeParseStepContent("explanation", content);
    const explore = parsed.success ? parsed.data.explore : undefined;

    return explore?.template === "labeledDiagram" ? explore.fields : null;
  }

  return null;
}

/** The picture one option of a question asks for: `optionId` names the option it shows. */
export type OptionPictureRequest = {
  alt: string;
  optionId: string;
  prompt: string;
  screenText: string;
};

/**
 * The pictures a question whose options are pictures asks for, one per option, each drawn alone.
 * The screen text is the question, never an option's name, so no picture is drawn with the answer
 * written on it.
 */
export function getOptionPictureRequests({
  content,
  kind,
}: {
  content: unknown;
  kind: StepKind;
}): OptionPictureRequest[] {
  if (kind !== "check") {
    return [];
  }

  const parsed = safeParseStepContent("check", content);

  if (!parsed.success) {
    return [];
  }

  const screenText = [parsed.data.context, parsed.data.question].filter(Boolean).join("\n");

  return parsed.data.options.flatMap((option) =>
    option.picture
      ? [
          {
            alt: option.picture.alt,
            optionId: option.id,
            prompt: option.picture.prompt,
            screenText,
          },
        ]
      : [],
  );
}
