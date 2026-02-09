import { parseStepContent } from "@zoonk/core/steps/content-contract";

export type ActivitySteps = { title: string; text: string }[];

function parseStaticTextStep(content: unknown): ActivitySteps[number] {
  const parsed = parseStepContent("static", content);

  if (parsed.variant !== "text") {
    throw new Error("Invalid static text step content");
  }

  return { text: parsed.text, title: parsed.title };
}

export function parseActivitySteps(steps: { content: unknown }[]): ActivitySteps {
  return steps.map((step) => parseStaticTextStep(step.content));
}
