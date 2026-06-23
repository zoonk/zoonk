import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./course-learn-classification.prompt.md";

const defaultModel = "google/gemini-3.1-flash-lite";
const fallbackModels = ["openai/gpt-5.4-mini"] as const;

const learnRequestClassificationSchema = z.enum(["question", "personalized", "course"]);

const schema = z.object({ classification: learnRequestClassificationSchema });

export type LearnRequestClassification = z.infer<typeof learnRequestClassificationSchema>;
export type CourseLearnClassificationSchema = z.infer<typeof schema>;

export type CourseLearnClassificationParams = {
  language: string;
  prompt: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Decides the product shape for a normal learn request after coarse routing has
 * already removed unsafe, language, and exam goals. Keeping this separate from
 * routing prevents safety and redirect rules from competing with the nuanced
 * decision between a quick answer, reusable course, and personalized track.
 */
export async function classifyLearnRequest({
  language,
  model = defaultModel,
  prompt,
  reasoningEffort,
  useFallback = true,
}: CourseLearnClassificationParams) {
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

  return { data: output, systemPrompt, usage, userPrompt };
}
