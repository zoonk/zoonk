import { type StepKind } from "@zoonk/db";
import { labeledPictureRequest } from "../../activities/templates/labeled-diagram";
import { safeParseStepContent } from "../../steps/contract/step-contract";

const SCREEN_TEXT_FIELDS = [
  "title",
  "question",
  "prompt",
  "context",
  "problem",
  "text",
  "reveal",
] as const;

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

export type OptionPictureRequest = {
  alt: string;
  optionId: string;
  prompt: string;
  screenText: string;
};

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
