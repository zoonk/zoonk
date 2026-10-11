import "server-only";
import { Output, generateText, isStepCount } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { selectPromptVariants } from "../../_utils/prompt-variants";
import promptTemplate from "./find-official-sources.prompt.md";
import {
  type ExamResearchPlan,
  type ResearchSearchPlan,
  type ResearchTopic,
} from "./research-plan";
import {
  type ResearchSearchTool,
  buildResearchSearchTools,
  collectSearchedHosts,
  isOnSearchedHost,
} from "./research-search-tools";

/**
 * The `find-official-sources` eval (5 real exams): Flash with Parallel found the
 * current official notice every time in about 10 seconds for about $0.02, the
 * cheapest of the combinations that found all five.
 */
const defaultModel = "google/gemini-3.8-flash";
const defaultSearchTool: ResearchSearchTool = "parallel";

/** Up to six searches and the structured answer. */
const MAX_STEPS = 8;
const MAX_DOCUMENTS = 6;

const DOCUMENT_TYPES = [
  "notice",
  "correction",
  "syllabus",
  "pastPaper",
  "officialPage",
  "terms",
  "law",
  "documentation",
  "other",
] as const;

const documentSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  kind: z.enum(["official", "secondary"]),
  publisher: z.string().nullable(),
  reason: z.string(),
  title: z.string(),
  url: z.string(),
});

const schema = z.object({ documents: z.array(documentSchema), officialFound: z.boolean() });

export type FoundSourceDocument = z.infer<typeof documentSchema>;

/** What search reads of a research plan: an exam's also names its board, edition and role. */
type SearchedPlan = Pick<ResearchSearchPlan, "country" | "name" | "officialDomains" | "queries"> &
  Partial<Pick<ExamResearchPlan, "board" | "edition" | "role">>;

export type FindOfficialSourcesParams = {
  plan: SearchedPlan;
  /** What research reads; left out when confirming an upload, whose topic isn't known. */
  topic?: ResearchTopic;
  /**
   * Documents an earlier search found that couldn't be downloaded (a board's site that refuses
   * automated downloads): the search looks for the same documents on other sites instead.
   */
  unreadable?: readonly string[];
  searchTool?: ResearchSearchTool;
  model?: string;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/**
 * Only the fields search uses, picked at runtime: a whole plan also carries its search terms,
 * language and whether it's a class test, which search never reads.
 */
function toSearchedFields(plan: SearchedPlan): Required<SearchedPlan> {
  return {
    board: plan.board ?? null,
    country: plan.country,
    edition: plan.edition ?? null,
    name: plan.name,
    officialDomains: plan.officialDomains,
    queries: plan.queries,
    role: plan.role ?? null,
  };
}

function toPlanPrompt({
  plan,
  topic,
  unreadable = [],
}: Pick<FindOfficialSourcesParams, "plan" | "topic" | "unreadable">): string {
  return [
    topic && `TOPIC: ${topic}`,
    `TODAY: ${new Date().toISOString().slice(0, 10)}`,
    unreadable.length > 0 && `UNREADABLE:\n${unreadable.map((url) => `- ${url}`).join("\n")}`,
    `PLAN:\n${JSON.stringify(toSearchedFields(plan), null, 2)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Searches official domains first for an exam's current notice, a law's text,
 * a product's documentation or a subject's reference syllabi, or, given the
 * documents that couldn't be downloaded (`unreadable`), copies of them on other
 * sites. Addresses on sites no search returned are dropped, since the model
 * invented them. Fallback models aren't used: each search tool is tied to the
 * model it's measured with.
 */
export async function findOfficialSources({
  analytics,
  model = defaultModel,
  plan,
  reasoning,
  searchTool = defaultSearchTool,
  topic,
  unreadable = [],
}: FindOfficialSourcesParams) {
  const userPrompt = toPlanPrompt({ plan, topic, unreadable });

  // A search for copies of documents that couldn't be downloaded reads its own rules.
  const systemPrompt = selectPromptVariants({
    template: promptTemplate,
    variants: { unreadable: unreadable.length > 0 },
  });

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
    libraryInput: true,
    promptVersion: `search:${searchTool}`,
    systemPrompt,
    task: "find-official-sources",
  });

  const hosts = collectSearchedHosts({
    sources: result.sources,
    toolResults: result.steps.flatMap((step) => step.toolResults),
  });

  const documents = result.output.documents
    .filter((document) => isOnSearchedHost({ hosts, url: document.url }))
    .slice(0, MAX_DOCUMENTS);

  return {
    data: {
      documents,
      officialFound:
        result.output.officialFound && documents.some((document) => document.kind === "official"),
      searchCalls: result.steps.flatMap((step) => step.toolCalls).length,
    },
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt,
  };
}
