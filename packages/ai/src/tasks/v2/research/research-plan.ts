import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { type ChangingFactsTopic } from "./changing-facts";
import systemPrompt from "./research-plan.prompt.md";

/** The `research-plan` eval: all three candidates named every exam right; Flash was cheapest and fastest. */
const defaultModel = "google/gemini-3.8-flash";
const fallbackModels = ["openai/gpt-6-sol", "anthropic/claude-opus-5.5"] as const;

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

/**
 * What research reads for a goal: an exam's official documents, a law's or a product's current
 * text (the facts that change, from `detectChangingFacts`), or reference syllabi (university
 * courses and official curricula) that a big learn goal's curriculum is checked against.
 */
export type ResearchTopic = Exclude<ChangingFactsTopic, "none"> | "syllabus";

/** What every research plan names, an exam's or a source's: what to search for and where. */
export type ResearchSearchPlan = Pick<
  ExamResearchPlan,
  "country" | "language" | "name" | "officialDomains" | "queries" | "searchTerms"
>;

export type ExamResearchPlanParams = {
  goal: string;
  /** The understood fields of the goal (exam, date, role), as JSON. */
  details?: string | null;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
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

/** Codes in their canonical case, bare domains, and no more domains, queries or terms than search uses. */
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

/** The learner's goal and what onboarding understood of it, marked as data, after today's date. */
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

/**
 * Names what research looks for when a goal prepares for an exam: the canonical
 * exam (name and role, which are its identity), whether it's a teacher's own test,
 * where its organizer publishes, and the queries that find the current notice. It
 * never states facts about the exam itself. Laws, products and syllabi have their
 * own plan (`generateSourceResearchPlan`).
 */
export async function generateExamResearchPlan({
  analytics,
  details,
  goal,
  model = defaultModel,
  reasoning,
  useFallback = true,
}: ExamResearchPlanParams) {
  const userPrompt = formatResearchGoal({ details, goal });
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

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
    libraryInput: true,
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
