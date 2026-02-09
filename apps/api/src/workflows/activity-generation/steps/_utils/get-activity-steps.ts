import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { isJsonObject } from "@zoonk/utils/json";

export type ActivitySteps = { title: string; text: string }[];

type LegacyStaticText = {
  text: string;
  title: string;
};

function parseLegacyStaticText(content: unknown): LegacyStaticText | null {
  if (!isJsonObject(content)) {
    return null;
  }

  if (typeof content.title !== "string" || typeof content.text !== "string") {
    return null;
  }

  return { text: content.text, title: content.title };
}

function parseStaticTextStep(content: unknown): LegacyStaticText {
  try {
    const parsed = parseStepContent("static", content);

    if (parsed.variant === "text") {
      return { text: parsed.text, title: parsed.title };
    }
  } catch {
    // Fallback for legacy local fixture/test data that still uses { title, text }.
  }

  const legacy = parseLegacyStaticText(content);

  if (legacy) {
    return legacy;
  }

  throw new Error("Invalid static text step content");
}

export function parseActivitySteps(steps: { content: unknown }[]): ActivitySteps {
  return steps.map((step) => parseStaticTextStep(step.content));
}
