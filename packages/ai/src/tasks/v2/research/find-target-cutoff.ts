import "server-only";
import { Output, generateText, isStepCount } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import systemPrompt from "./find-target-cutoff.prompt.md";
import {
  type ResearchSearchTool,
  buildResearchSearchTools,
  collectSearchedHosts,
  isOnSearchedHost,
} from "./research-search-tools";
import { toTargetCutoffFinding } from "./target-cutoff-finding";

export type { TargetCutoffFinding } from "./target-cutoff-finding";

/**
 * The pair `find-course-weights` uses (Gemini 3.8 Flash with Parallel), at low reasoning: the same
 * kind of lookup, one number on a page a search returns, about two cents a target, once a year.
 */
const defaultModel = "google/gemini-3.8-flash";
const defaultSearchTool: ResearchSearchTool = "parallel";
const defaultReasoning: Reasoning = "low";

/** A few searches and the answer. */
const MAX_STEPS = 5;

const schema = z.object({
  edition: z.string().nullable(),
  maxScore: z.number().nullable(),
  quota: z.string().nullable(),
  score: z.number().nullable(),
  sourceTitle: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  status: z.enum(["found", "unknown"]),
});

type FindTargetCutoffInput = {
  /** The course the learner wants ("Medicina"), or null for a position. */
  course: string | null;
  /** The exam, with the role it's for when it has one ("ENEM"). */
  exam: string;
  /** The institution the learner wants ("UFMG"), or null. */
  institution: string | null;
  /** The position the learner wants in a public-service exam, or null. */
  position: string | null;
  /** The learner-local date, YYYY-MM-DD. */
  today: string;
};

export type FindTargetCutoffParams = FindTargetCutoffInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  searchTool?: ResearchSearchTool;
};

function buildUserPrompt(input: FindTargetCutoffInput): string {
  return `
    TODAY: ${input.today}

${formatUntrustedInput({
  COURSE: input.course ?? "none",
  EXAM: input.exam,
  INSTITUTION: input.institution ?? "none",
  POSITION: input.position ?? "none",
})}
  `;
}

/**
 * Looks up the last published cut-off of the learner's target, for the general list: a course at
 * an institution that selects by the exam's score (SISU's last cut-off for Medicina at UFMG), or a
 * public-service exam's position, so the learner sees where the bar was next to their own goal.
 * Only one source's cut-off for that exact target, on a page a search returned, is kept; anything
 * else reads as not known. Fallback models aren't used: the search tool is tied to the model it's
 * measured with.
 */
export async function findTargetCutoff({
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  searchTool = defaultSearchTool,
  ...input
}: FindTargetCutoffParams) {
  const userPrompt = buildUserPrompt(input);
  const providerOptions = buildProviderOptions({ fallbackModels: [], model, useFallback: false });

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
        stopWhen: isStepCount(MAX_STEPS),
        tools: buildResearchSearchTools({ model, searchTool }),
      }),
    promptVersion: `search:${searchTool}`,
    systemPrompt,
    task: "find-target-cutoff",
  });

  const hosts = collectSearchedHosts({
    sources: result.sources,
    toolResults: result.steps.flatMap((step) => step.toolResults),
  });

  const data = toTargetCutoffFinding({
    isSearched: (url) => isOnSearchedHost({ hosts, url }),
    raw: result.output,
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
