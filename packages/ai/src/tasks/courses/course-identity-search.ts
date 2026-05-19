import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import searchPrompt from "./course-identity-search.prompt.md";

const defaultModel = "openai/gpt-5.5";
const fallbackModels = ["anthropic/claude-opus-4.7", "google/gemini-3.1-pro-preview"] as const;
const MAX_SEARCH_QUERIES = 8;

const searchSchema = z.object({ queries: z.array(z.string()).max(MAX_SEARCH_QUERIES) });

export type CourseIdentitySearchSchema = z.infer<typeof searchSchema>;

type CourseIdentitySuggestion = {
  description: string | null;
  language: string;
  targetLanguage: string | null;
  title: string;
};

export type CourseIdentitySearchParams = {
  suggestion: CourseIdentitySuggestion;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Builds provider options inside the search task so this file remains
 * standalone. The classifier task duplicates the same small defaults because
 * each AI task should be readable without following another course-identity
 * helper.
 */
function buildProviderConfig({
  model,
  reasoningEffort,
  useFallback,
}: {
  model: string;
  reasoningEffort?: ReasoningEffort;
  useFallback: boolean;
}) {
  return buildProviderOptions({ fallbackModels, model, reasoningEffort, useFallback });
}

/**
 * Builds the candidate-retrieval prompt separately from classification because
 * this step is allowed to be recall-oriented. The classifier stays conservative
 * once candidates are known.
 */
function buildSearchUserPrompt(params: CourseIdentitySearchParams): string {
  return JSON.stringify({ proposedCourse: params.suggestion }, null, 2);
}

/**
 * Generates likely search phrases for finding existing courses that may be
 * semantic duplicates of the proposed course. This gives the database lookup
 * cross-language and abbreviation recall without storing speculative aliases.
 */
export async function generateCourseIdentitySearchQueries({
  model = defaultModel,
  reasoningEffort,
  suggestion,
  useFallback = true,
}: CourseIdentitySearchParams) {
  const userPrompt = buildSearchUserPrompt({ suggestion });
  const providerOptions = buildProviderConfig({ model, reasoningEffort, useFallback });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema: searchSchema }),
    prompt: userPrompt,
    providerOptions,
    system: searchPrompt,
  });

  return { data: output, systemPrompt: searchPrompt, usage, userPrompt };
}
