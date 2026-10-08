import "server-only";
import { Output, generateText, isStepCount } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { toChoiceOptionsFinding } from "./choice-options-finding";
import systemPrompt from "./find-choice-options.prompt.md";
import {
  type ResearchSearchTool,
  buildResearchSearchTools,
  collectSearchedHosts,
  isOnSearchedHost,
} from "./research-search-tools";

export type { ChoiceOptionsFinding } from "./choice-options-finding";

/**
 * The pair `find-subject-questions` uses to read a page a search returns (Gemini 3.8 Flash with
 * Parallel), at low reasoning: a learner's placement may wait on it.
 */
const defaultModel = "google/gemini-3.8-flash";
const defaultSearchTool: ResearchSearchTool = "parallel";
const defaultReasoning: Reasoning = "low";

/** A few searches and the answer. */
const MAX_STEPS = 4;

const schema = z.object({
  edition: z.string().nullable(),
  options: z.number().int().nullable(),
  sourceTitle: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  status: z.enum(["found", "unknown"]),
});

type FindChoiceOptionsInput = {
  board: string | null;
  /** The exam and, when it has phases or roles, the learner's ("OAB…, 1ª fase"). */
  exam: string;
  /** The learner-local date, YYYY-MM-DD. */
  today: string;
};

export type FindChoiceOptionsParams = FindChoiceOptionsInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  searchTool?: ResearchSearchTool;
};

function buildUserPrompt(input: FindChoiceOptionsInput): string {
  return `
    TODAY: ${input.today}

${formatUntrustedInput({ BOARD: input.board ?? "", EXAM: input.exam })}
  `;
}

/**
 * Looks up how many options each of an exam's multiple-choice questions had in its latest
 * editions, for a notice that says its questions are multiple choice without saying how many
 * options they have (the Enem's page says "180 questões objetivas"): the questions the app writes
 * and picks for the exam have that many. Only a whole number on a page a search returned is kept;
 * anything else reads as not known. Fallback models aren't used: the search tool is tied to the
 * model it's measured with.
 */
export async function findChoiceOptions({
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  searchTool = defaultSearchTool,
  ...input
}: FindChoiceOptionsParams) {
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
    task: "find-choice-options",
  });

  const hosts = collectSearchedHosts({
    sources: result.sources,
    toolResults: result.steps.flatMap((step) => step.toolResults),
  });

  const data = toChoiceOptionsFinding({
    isSearched: (url) => isOnSearchedHost({ hosts, url }),
    raw: result.output,
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
