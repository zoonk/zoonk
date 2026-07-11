import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./language-course-chapters.prompt.md";

const defaultModel = "openai/gpt-5.6-sol";
const fallbackModels = ["openai/gpt-5.6-terra", "anthropic/claude-fable-5"] as const;

const schema = z.object({
  chapters: z.array(z.object({ description: z.string(), title: z.string() })),
});

export type LanguageCourseChaptersSchema = z.infer<typeof schema>;

export type LanguageCourseChaptersParams = {
  userLanguage: string;
  targetLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

export async function generateLanguageCourseChapters({
  userLanguage,
  targetLanguage,
  model = defaultModel,
  useFallback = true,
  reasoning,
}: LanguageCourseChaptersParams) {
  const targetLanguageName = getPromptLanguageName({ language: targetLanguage, userLanguage });
  const userLanguageName = getPromptLanguageName({ language: userLanguage });

  const userPrompt = `
    USER_LANGUAGE: ${userLanguageName}
    TARGET_LANGUAGE: ${targetLanguageName}
  `;

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { output, usage } = await generateText({
    instructions: systemPrompt,
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    reasoning,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
