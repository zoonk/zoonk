import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./course-suggestions.prompt.md";

const defaultModel = "openai/gpt-5.4-mini";
const fallbackModels = ["google/gemini-3-flash"] as const;

const schema = z.object({
  courses: z.array(
    z.object({
      description: z.string(),
      targetLanguageCode: z.string().nullable(),
      title: z.string(),
    }),
  ),
});

export type CourseSuggestionSchema = z.infer<typeof schema>;

export type CourseSuggestionsParams = {
  language: string;
  prompt: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateCourseSuggestions({
  language,
  prompt,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: CourseSuggestionsParams) {
  const promptLanguage = getPromptLanguageName({ language });

  const userPrompt = `
    LANGUAGE: ${promptLanguage}
    USER_INPUT: ${prompt}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
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

  return { data: output.courses, systemPrompt, usage, userPrompt };
}
