import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./course-learn-language.prompt.md";

const languageCode = z.string().min(2).max(10);

const schema = z.object({ targetLanguage: languageCode, userLanguage: languageCode });

const defaultModel = "google/gemini-3.1-flash-lite";

const fallbackModels = [
  "openai/gpt-5.4-mini",
  "deepseek/deepseek-v4-flash",
  "anthropic/claude-haiku-4.5",
] as const;

export type CourseLearnLanguageSchema = z.infer<typeof schema>;

export type CourseLearnLanguageParams = {
  language: string;
  prompt: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Builds the language-pair prompt with both the raw learner goal and the UI
 * locale. The raw goal has priority because a learner may type in a different
 * language than the app interface they are currently using.
 */
function buildCourseLearnLanguageUserPrompt({
  language,
  prompt,
}: Pick<CourseLearnLanguageParams, "language" | "prompt">): string {
  const promptLanguage = getPromptLanguageName({ language });

  return JSON.stringify({ uiLanguage: promptLanguage, userGoal: prompt }, null, 2);
}

/**
 * Resolves the language pair for language-course generation. Keeping this as a
 * separate task avoids letting the generic course-suggestion prompt decide the
 * learner language from the UI locale when the learner's typed goal says more.
 */
export async function resolveCourseLearnLanguage({
  language,
  model = defaultModel,
  prompt,
  reasoningEffort,
  useFallback = true,
}: CourseLearnLanguageParams) {
  const userPrompt = buildCourseLearnLanguageUserPrompt({ language, prompt });

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

  return { data: output, systemPrompt, usage, userPrompt };
}
