import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import searchPrompt from "./course-identity-search.prompt.md";

const defaultModel = "openai/gpt-5.6-luna";
const fallbackModels = ["anthropic/claude-sonnet-4.6"] as const;

const searchSchema = z.object({ queries: z.array(z.string()) });

export type CourseIdentitySearchSchema = z.infer<typeof searchSchema>;

type CourseIdentityProposedCourse = {
  description: string | null;
  language: string;
  targetLanguage: string | null;
  title: string;
};

export type CourseIdentitySearchParams = {
  proposedCourse: CourseIdentityProposedCourse;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Builds the candidate-retrieval prompt separately from classification because
 * this step is allowed to be recall-oriented. The classifier stays conservative
 * once candidates are known.
 */
function buildSearchUserPrompt(params: CourseIdentitySearchParams): string {
  return JSON.stringify({ proposedCourse: params.proposedCourse }, null, 2);
}

/**
 * Generates likely search phrases for finding existing courses that may be
 * semantic duplicates of the proposed course. This gives the database lookup
 * cross-language and abbreviation recall without storing speculative aliases.
 */
export async function generateCourseIdentitySearchQueries({
  model = defaultModel,
  proposedCourse,
  reasoningEffort,
  useFallback = true,
}: CourseIdentitySearchParams) {
  const userPrompt = buildSearchUserPrompt({ proposedCourse });

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    reasoningEffort,
    useFallback,
  });

  const { output, usage } = await generateText({
    instructions: searchPrompt,
    model,
    output: Output.object({ schema: searchSchema }),
    prompt: userPrompt,
    providerOptions,
  });

  return { data: output, systemPrompt: searchPrompt, usage, userPrompt };
}
