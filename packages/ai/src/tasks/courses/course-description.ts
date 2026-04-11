import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./course-description.prompt.md";

const DEFAULT_MODEL = "openai/gpt-5.4-nano";
const FALLBACK_MODELS = ["google/gemini-3-flash", "anthropic/claude-haiku-4.5"];

const schema = z.object({
  description: z.string(),
});

export type CourseDescriptionSchema = z.infer<typeof schema>;

export type CourseDescriptionParams = {
  title: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateCourseDescription({
  title,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: CourseDescriptionParams) {
  const userPrompt = `
    COURSE_TITLE: ${title}
    LANGUAGE: ${language}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
    model,
    reasoningEffort,
    taskName: "course-description",
    useFallback,
  });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
