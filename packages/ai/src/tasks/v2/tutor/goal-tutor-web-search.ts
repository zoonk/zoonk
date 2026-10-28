import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type InferToolInput, type StepResult, generateText, isStepCount, tool } from "ai";
import { z } from "zod";
import { zoonkGateway } from "../../../gateway";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { buildProviderOptions } from "../../../provider-options";
import { type GoalTutorSearchSources, buildSearchQueries } from "./goal-tutor-search-query";
import systemPrompt from "./goal-tutor-web-search.prompt.md";

/**
 * The gateway runs a search only on a model's tool call (`@ai-sdk/gateway` 4.0.110), so a model
 * that reads nothing but the code-built queries makes it. Sonnet 5.5 refuses a required tool.
 */
const SEARCH_MODEL = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;
const SEARCH_TASK = "goal-tutor-web-search";

/**
 * Not named `web_search`: through the gateway, OpenAI reads a required tool by that name as its own
 * built-in search and rejects the request ("Tool choice 'web_search_preview' not found").
 */
const PARALLEL_TOOL = "searchWeb";

/**
 * The model may ask for more results than the tool's settings, so the buddy reads at most these.
 */
const SEARCH_RESULTS = 5;
const SEARCH_CHARACTERS_PER_RESULT = 1500;

/** Past this, the buddy answers without the search. */
export const SEARCH_DEADLINE_MS = 15_000;

const parallelTools = {
  [PARALLEL_TOOL]: zoonkGateway.tools.parallelSearch({
    excerpts: { maxCharsPerResult: SEARCH_CHARACTERS_PER_RESULT },
    maxResults: SEARCH_RESULTS,
    mode: "agentic",
  }),
};

type SearchSource = { excerpt: string; publishDate: string | null; title: string; url: string };

/**
 * The gateway sends `search_id`, `excerpts` and `publish_date` (14 Oct 2026), not the shape
 * `@ai-sdk/gateway` 4.0.110 declares: both are read, so a fix on either side changes nothing.
 */
const parallelOutputSchema = z.object({
  results: z.array(
    z.object({
      excerpt: z.string().optional(),
      excerpts: z.array(z.string()).optional(),
      publishDate: z.string().nullish(),
      publish_date: z.string().nullish(),
      title: z.string().nullish(),
      url: z.string(),
    }),
  ),
});

type ParallelSource = z.infer<typeof parallelOutputSchema>["results"][number];

function toSearchSource(source: ParallelSource): SearchSource {
  const excerpt = source.excerpts?.join("\n\n") ?? source.excerpt ?? "";

  return {
    excerpt: excerpt.slice(0, SEARCH_CHARACTERS_PER_RESULT),
    publishDate: source.publish_date ?? source.publishDate ?? null,
    title: source.title ?? "",
    url: source.url,
  };
}

/** `searched` is what was actually sent. */
export type GoalTutorSearchResult =
  | {
      results: SearchSource[];
      searched: InferToolInput<(typeof parallelTools)[typeof PARALLEL_TOOL]>[];
      status: "found";
    }
  | { status: "nothingToSearch" | "unavailable" };

const SEARCH_DESCRIPTION =
  "Searches the web for current sources on a fact that changes: the law and court rulings on it, official or exam rules, figures. Search once per message, with up to three keyword queries (such as one for the provision and one for court rulings on it). Only the subject's terms reach the search: the law's, courts' and exam rules' words, the names of the exam, course and screen they study, and references (a law's number and year, an article, a ruling, this year). Names, places, employers and other numbers are dropped.";

function uniqueByUrl(sources: readonly SearchSource[]): SearchSource[] {
  return sources.filter(
    (source, index) => sources.findIndex(({ url }) => url === source.url) === index,
  );
}

function toSearchResult(steps: readonly StepResult<typeof parallelTools>[]): GoalTutorSearchResult {
  const searched = steps.flatMap((step) => step.staticToolCalls.map((call) => call.input));

  const found = steps.flatMap((step) =>
    step.staticToolResults.flatMap((result) => {
      const output = parallelOutputSchema.safeParse(result.output);
      return output.success ? [output.data.results] : [];
    }),
  );

  if (found.length === 0) {
    return { status: "unavailable" };
  }

  const results = uniqueByUrl(found.flat().map((source) => toSearchSource(source)));

  return { results: results.slice(0, SEARCH_RESULTS), searched, status: "found" };
}

/** A failure or the deadline reads as `unavailable`, so the buddy answers without it. */
async function searchWeb({
  abortSignal,
  analytics,
  queries,
}: {
  abortSignal?: AbortSignal;
  analytics?: AiGenerationContext;
  queries: readonly string[];
}): Promise<GoalTutorSearchResult> {
  const { data, error } = await safeAsync(async () => {
    const { result } = await runTaskGeneration({
      analytics,
      generate: () =>
        generateText({
          abortSignal,
          instructions: systemPrompt,
          model: SEARCH_MODEL,
          prompt: queries.join("\n"),
          providerOptions: buildProviderOptions({
            fallbackModels,
            model: SEARCH_MODEL,
            useFallback: true,
          }),
          reasoning: "none",
          stopWhen: isStepCount(1),
          toolChoice: { toolName: PARALLEL_TOOL, type: "tool" },
          tools: parallelTools,
        }),
      systemPrompt,
      task: SEARCH_TASK,
    });

    return toSearchResult(result.steps);
  });

  if (error) {
    // A provider's error can quote its request: only its kind is logged.
    if (!abortSignal?.aborted) {
      logError("[Goal Tutor Web Search Error]", { name: error.name });
    }

    return { status: "unavailable" };
  }

  return data;
}

/**
 * What goes out is built in code (`buildSearchQueries`) and searched in a call that reads nothing
 * else. A second call in the same message reads the first one's result instead of searching again.
 */
export function createSearchWebTool({
  analytics,
  ...sources
}: GoalTutorSearchSources & { analytics?: AiGenerationContext }) {
  let search: Promise<GoalTutorSearchResult> | null = null;

  function runSearch({
    abortSignal,
    queries,
  }: {
    abortSignal?: AbortSignal;
    queries: readonly string[];
  }): Promise<GoalTutorSearchResult> {
    const built = buildSearchQueries({ ...sources, queries });

    return built.length === 0
      ? Promise.resolve({ status: "nothingToSearch" })
      : searchWeb({ abortSignal, analytics, queries: built });
  }

  return tool({
    description: SEARCH_DESCRIPTION,
    execute: ({ queries }, { abortSignal }): Promise<GoalTutorSearchResult> => {
      search ??= runSearch({ abortSignal, queries });
      return search;
    },
    inputSchema: z.object({
      queries: z
        .array(z.string())
        .describe(
          "One to three short keyword queries, each naming the subject's terms: the law and article, the court and ruling, the rule or topic, in the words of the learner's message",
        ),
    }),
  });
}
