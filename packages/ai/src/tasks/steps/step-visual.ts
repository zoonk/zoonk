import "server-only";

import { generateText, stepCountIs } from "ai";
import { buildProviderOptions, type ReasoningEffort } from "../../types";

import { type StepVisualResource, visualTools } from "./_tools/visual";
import systemPrompt from "./step-visual.prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_STEP_VISUAL ?? "google/gemini-3-flash";

const FALLBACK_MODELS = [
  "openai/gpt-5.2",
  "anthropic/claude-haiku-4.5",
  "openai/gpt-5-mini",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-opus-4.5",
  "google/gemini-3-pro-preview",
];

export type StepVisualSchema = {
  visuals: StepVisualResource[];
};

export type StepVisualParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  steps: Array<{ title: string; text: string }>;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateStepVisuals({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  steps,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: StepVisualParams) {
  const formattedSteps = steps
    .map((step, index) => `${index}. ${step.title}: ${step.text}`)
    .join("\n");

  const userPrompt = `LESSON_TITLE: ${lessonTitle}
LESSON_DESCRIPTION: ${lessonDescription}
CHAPTER_TITLE: ${chapterTitle}
COURSE_TITLE: ${courseTitle}
LANGUAGE: ${language}
STEPS:
${formattedSteps}

Generate one visual resource for each step. Use the stepIndex field to match each visual to its corresponding step (0-based index). Choose the most appropriate visual type for each step's content.`;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
    reasoningEffort,
    useFallback,
  });

  const { steps: generationSteps, usage } = await generateText({
    model,
    prompt: userPrompt,
    providerOptions,
    stopWhen: stepCountIs(steps.length),
    system: systemPrompt,
    toolChoice: "required",
    tools: visualTools,
  });

  const visuals = generationSteps.flatMap((step) =>
    step.toolCalls
      .filter((call) => !call.dynamic)
      .map((call) => ({
        kind: call.toolName as StepVisualResource["kind"],
        ...call.input,
      })),
  ) as StepVisualResource[];

  return { data: { visuals }, systemPrompt, usage, userPrompt };
}
