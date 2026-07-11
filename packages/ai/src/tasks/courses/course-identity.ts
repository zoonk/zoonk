import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import classificationPrompt from "./course-identity.prompt.md";

const defaultModel = "google/gemini-3.1-flash-lite";
const fallbackModels = ["openai/gpt-5.4-mini", "deepseek/deepseek-v4-flash"] as const;

const identitySchema = z.object({
  courseSlug: z.string().nullable(),
  decision: z.enum(["useExisting", "createNew"]),
  reason: z.string(),
});

export type CourseIdentityProposedCourse = {
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
  proposedCourse: CourseIdentityProposedCourse;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

/**
 * Builds one stable prompt payload so evals and production use the same
 * candidate-classification contract. Keeping this JSON-shaped avoids prompt
 * wording drift when candidate fields are added later.
 */
function buildIdentityUserPrompt(params: CourseIdentityParams): string {
  return JSON.stringify(
    { candidates: params.candidates, proposedCourse: params.proposedCourse },
    null,
    2,
  );
}

/**
 * Enforces the output invariant that the schema cannot express strongly across
 * every provider: creating a new course must not carry an existing-course slug.
 * This keeps downstream workflow logic and eval scoring aligned even when a
 * model gets the decision right but leaves a stale candidate slug in the JSON.
 */
function normalizeIdentityOutput(output: CourseIdentitySchema): CourseIdentitySchema {
  if (output.decision === "createNew") {
    return { ...output, courseSlug: null };
  }

  return output;
}

/**
 * Classifies whether a proposed course should reuse one of the supplied
 * candidates. The database remains the source of candidate truth; the model only
 * decides semantic identity among those explicit options.
 */
export async function resolveCourseIdentity({
  candidates,
  model = defaultModel,
  proposedCourse,
  reasoning,
  useFallback = true,
}: CourseIdentityParams) {
  const userPrompt = buildIdentityUserPrompt({ candidates, proposedCourse });

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { output, usage } = await generateText({
    instructions: classificationPrompt,
    model,
    output: Output.object({ schema: identitySchema }),
    prompt: userPrompt,
    providerOptions,
    reasoning,
  });

  return {
    data: normalizeIdentityOutput(output),
    systemPrompt: classificationPrompt,
    usage,
    userPrompt,
  };
}
