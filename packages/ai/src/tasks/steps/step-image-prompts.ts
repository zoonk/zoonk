import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./step-image-prompts.prompt.md";

const DEFAULT_MODEL = "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"];

const imagePromptSchema = z.string().min(1);

/**
 * The workflow generates exactly one image for each readable teaching step.
 * Matching the schema length to the input keeps prompt generation aligned with
 * the saved step order, which prevents image/step mismatches downstream.
 */
function buildSchema(stepCount: number) {
  return z.object({
    prompts: z.array(imagePromptSchema).length(stepCount),
  });
}

type StepImagePromptsParams = {
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

/**
 * Generates one illustration prompt per step. The downstream image task owns
 * rendering style and file generation; this task only decides what scene each
 * step should show.
 */
export async function generateStepImagePrompts({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  steps,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: StepImagePromptsParams) {
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
    model,
    reasoningEffort,
    taskName: "step-image-prompts",
    useFallback,
  });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema: buildSchema(steps.length) }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
