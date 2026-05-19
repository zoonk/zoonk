import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import searchPrompt from "./course-identity-search.prompt.md";
import classificationPrompt from "./course-identity.prompt.md";

const defaultModel = "openai/gpt-5.5";
const fallbackModels = ["anthropic/claude-opus-4.7", "google/gemini-3.1-pro-preview"] as const;
const MAX_SEARCH_QUERIES = 8;

const candidateSchema = z.object({
  description: z.string().nullable(),
  language: z.string(),
  slug: z.string(),
  targetLanguage: z.string().nullable(),
  title: z.string(),
});

const suggestionSchema = z.object({
  description: z.string().nullable(),
  language: z.string(),
  targetLanguage: z.string().nullable(),
  title: z.string(),
});

const identitySchema = z.object({
  courseSlug: z.string().nullable(),
  decision: z.enum(["useExisting", "createNew"]),
  reason: z.string(),
});

const searchSchema = z.object({ queries: z.array(z.string()).max(MAX_SEARCH_QUERIES) });

export type CourseIdentityCandidate = z.infer<typeof candidateSchema>;
export type CourseIdentitySuggestion = z.infer<typeof suggestionSchema>;
export type CourseIdentitySchema = z.infer<typeof identitySchema>;
export type CourseIdentitySearchSchema = z.infer<typeof searchSchema>;

export type CourseIdentityParams = {
  candidates: CourseIdentityCandidate[];
  suggestion: CourseIdentitySuggestion;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export type CourseIdentitySearchParams = {
  suggestion: CourseIdentitySuggestion;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

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
 * Builds one stable prompt payload so evals and production use the same
 * candidate-classification contract. Keeping this JSON-shaped avoids prompt
 * wording drift when candidate fields are added later.
 */
function buildIdentityUserPrompt(params: CourseIdentityParams): string {
  return JSON.stringify(
    { candidates: params.candidates, proposedCourse: params.suggestion },
    null,
    2,
  );
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

/**
 * Classifies whether a proposed course should reuse one of the supplied
 * candidates. The database remains the source of candidate truth; the model only
 * decides semantic identity among those explicit options.
 */
export async function resolveCourseIdentity({
  candidates,
  model = defaultModel,
  reasoningEffort,
  suggestion,
  useFallback = true,
}: CourseIdentityParams) {
  const userPrompt = buildIdentityUserPrompt({ candidates, suggestion });
  const providerOptions = buildProviderConfig({ model, reasoningEffort, useFallback });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema: identitySchema }),
    prompt: userPrompt,
    providerOptions,
    system: classificationPrompt,
  });

  return { data: output, systemPrompt: classificationPrompt, usage, userPrompt };
}
