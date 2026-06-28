import "server-only";
import { type Reasoning, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import systemPrompt from "./lesson-pronunciation.prompt.md";

const defaultModel = "google/gemini-3-flash";
const fallbackModels = ["openai/gpt-5.5", "anthropic/claude-opus-4.7"] as const;

const schema = z.object({ pronunciation: z.string().min(1) });

export type LessonPronunciationSchema = z.infer<typeof schema>;

export type LessonPronunciationParams = {
  model?: string;
  reasoning?: Reasoning;
  targetLanguage: string;
  userLanguage: string;
  useFallback?: boolean;
  word: string;
};

export async function generateLessonPronunciation({
  model = defaultModel,
  reasoning,
  targetLanguage,
  userLanguage,
  useFallback = true,
  word,
}: LessonPronunciationParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `
    WORD: ${word}
    TARGET_LANGUAGE: ${promptContext.targetLanguageName}
    USER_LANGUAGE: ${promptContext.userLanguageName}
  `;

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    reasoning,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
