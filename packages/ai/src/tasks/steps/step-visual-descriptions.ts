import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./step-visual-descriptions.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_STEP_VISUAL_DESCRIPTIONS ?? "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6"];

const visualKindSchema = z.enum([
  "chart",
  "code",
  "diagram",
  "formula",
  "image",
  "music",
  "quote",
  "table",
  "timeline",
]);

const visualDescriptionSchema = z.object({
  description: z.string(),
  kind: visualKindSchema,
});

const schema = z.array(visualDescriptionSchema);

export type VisualDescription = z.infer<typeof visualDescriptionSchema>;

export type StepVisualDescriptionsSchema = {
  descriptions: VisualDescription[];
};

export type StepVisualDescriptionsParams = {
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
 * Generates a visual kind and description for each learning step.
 * Produces an ordered array of `{kind, description}` where the
 * array position matches the input step position. A separate
 * dispatcher then calls the appropriate per-kind visual generation
 * task (e.g., `generateVisualChart`, `generateVisualCode`) using
 * these descriptions.
 *
 * This two-stage approach decouples kind selection from content
 * generation, letting each per-kind task use a specialized model
 * optimized for that visual type.
 */
export async function generateStepVisualDescriptions({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  steps,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: StepVisualDescriptionsParams) {
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

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: { descriptions: output }, systemPrompt, usage, userPrompt };
}
