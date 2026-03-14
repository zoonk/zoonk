import "server-only";
import { generateText, stepCountIs } from "ai";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import { type StepVisualResource, visualTools } from "./_tools/visual";
import systemPrompt from "./step-visual.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_STEP_VISUAL ?? "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.5"];

export type StepVisualSchema = {
  visuals: StepVisualResource[];
};

export type StepVisualParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  steps: { title: string; text: string }[];
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
${formattedSteps}`;

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

  // Tool calls are typed by Vercel AI SDK but output structure matches StepVisualResource
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- AI tool outputs match expected schema
  const visuals = generationSteps.flatMap((step) =>
    step.toolCalls
      .filter((call) => !call.dynamic)
      .map((call) => ({
        kind: call.toolName,
        ...call.input,
      })),
  ) as StepVisualResource[];

  return { data: { visuals }, systemPrompt, usage, userPrompt };
}
