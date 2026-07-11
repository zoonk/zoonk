import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./course-description.prompt.md";

const defaultModel = "openai/gpt-5.4-mini";
const fallbackModels = ["google/gemini-3-flash", "anthropic/claude-haiku-4.5"] as const;

const schema = z.object({ description: z.string() });

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
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: CourseDescriptionParams) {
  const promptLanguage = getPromptLanguageName({ language });

  const userPrompt = `
    COURSE_TITLE: ${title}
    LANGUAGE: ${promptLanguage}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    reasoningEffort,
    useFallback,
  });

  const { output, usage } = await generateText({
    instructions: systemPrompt,
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
