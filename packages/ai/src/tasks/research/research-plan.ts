import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { type ChangingFactsTopic } from "./changing-facts";
import systemPrompt from "./research-plan.prompt.md";

/**
 * On 10 cases (8 Nov 2026), Luna scored 9.92 (EN 9.60, PT 10.00) at $0.33/1k against Flash's 10.00
 * at $2.37/1k and kept the CGU specialty; its one miss gives the SAT no country, a label still to
 * review. Haiku 5.5 scored 9.85.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["anthropic/claude-haiku-5.5"] as const;

const MAX_DOMAINS = 5;
const MAX_QUERIES = 4;
const MAX_TERMS = 5;

const schema = z.object({
  board: z.string().nullable(),
  classTest: z.boolean(),
  country: z.string(),
  edition: z.string().nullable(),
  language: z.string(),
  name: z.string(),
  officialDomains: z.array(z.string()),
  queries: z.array(z.string()),
  role: z.string().nullable(),
  searchTerms: z.array(z.string()),
});

export type ExamResearchPlan = z.infer<typeof schema>;

export type ResearchTopic = Exclude<ChangingFactsTopic, "none"> | "syllabus";

export type ResearchSearchPlan = Pick<
  ExamResearchPlan,
  "country" | "language" | "name" | "officialDomains" | "queries" | "searchTerms"
>;

export type ExamResearchPlanParams = {
  goal: string;
  details?: string | null;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  analytics?: AiGenerationContext;
};

/** Models sometimes add a scheme or a path; the search tools take bare domains. */
function toDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//u, "")
    .replace(/^www\./u, "")
    .replace(/\/+$/u, "");
}

export function normalizeResearchPlan<TPlan extends ResearchSearchPlan>(plan: TPlan): TPlan {
  return {
    ...plan,
    country: plan.country.trim().toUpperCase(),
    language: plan.language.trim().toLowerCase(),
    officialDomains: plan.officialDomains
      .map((domain) => toDomain(domain))
      .filter(Boolean)
      .slice(0, MAX_DOMAINS),
    queries: plan.queries.slice(0, MAX_QUERIES),
    searchTerms: plan.searchTerms.slice(0, MAX_TERMS),
  };
}

export function formatResearchGoal({
  details,
  goal,
}: {
  details?: string | null;
  goal: string;
}): string {
  return `TODAY: ${new Date().toISOString().slice(0, 10)}

${formatUntrustedInput({ DETAILS: details ?? "none", GOAL: goal })}`;
}

/** It never states facts about the exam itself. Its goal is the learner's, so it isn't `libraryInput`. */
export async function generateExamResearchPlan({
  analytics,
  details,
  goal,
  model = defaultModel,
  reasoning,
  serviceTier,
  useFallback = true,
}: ExamResearchPlanParams) {
  const userPrompt = formatResearchGoal({ details, goal });
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "research-plan",
  });

  return {
    data: normalizeResearchPlan(result.output),
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt,
  };
}
