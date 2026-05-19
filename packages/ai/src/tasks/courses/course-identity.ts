import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import classificationPrompt from "./course-identity.prompt.md";

const defaultModel = "openai/gpt-5.5";
const fallbackModels = ["anthropic/claude-opus-4.7", "google/gemini-3.1-pro-preview"] as const;

const identitySchema = z.object({
  courseSlug: z.string().nullable(),
  decision: z.enum(["useExisting", "createNew"]),
  reason: z.string(),
});

export type CourseIdentitySuggestion = {
  description: string | null;
  language: string;
  targetLanguage: string | null;
  title: string;
};

export type CourseIdentityCandidate = {
  description: string | null;
  language: string;
  slug: string;
  targetLanguage: string | null;
  title: string;
};

export type CourseIdentitySchema = z.infer<typeof identitySchema>;

export type CourseIdentityParams = {
  candidates: CourseIdentityCandidate[];
  suggestion: CourseIdentitySuggestion;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Builds provider options inside the classifier task so this file remains
 * standalone. The search task duplicates the same small defaults because each
 * AI task should be readable without following another course-identity helper.
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
