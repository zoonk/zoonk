import "server-only";
import { Output, generateText, isStepCount } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import systemPrompt from "./find-official-sources.prompt.md";
import { type ResearchPlan, type ResearchTopic } from "./research-plan";
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

export type FindOfficialSourcesParams = {
  plan: Pick<
    ResearchPlan,
    "board" | "country" | "edition" | "name" | "officialDomains" | "queries" | "role"
  >;
  /** What research reads; left out when confirming an upload, whose topic isn't known. */
  topic?: ResearchTopic;
  searchTool?: ResearchSearchTool;
  model?: string;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function toPlanPrompt({ plan, topic }: Pick<FindOfficialSourcesParams, "plan" | "topic">): string {
  return [
    topic && `TOPIC: ${topic}`,
    `TODAY: ${new Date().toISOString().slice(0, 10)}`,
    `PLAN:\n${JSON.stringify(plan, null, 2)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Searches official domains first for an exam's current notice, a law's text,
 * a product's documentation or a subject's reference syllabi. Addresses on
 * sites no search returned are dropped, since the model invented them.
 * Fallback models aren't used: each search tool is tied to the model it's
 * measured with.
 */
export async function findOfficialSources({
  analytics,
  model = defaultModel,
  plan,
  reasoning,
  searchTool = defaultSearchTool,
  topic,
}: FindOfficialSourcesParams) {
  const userPrompt = toPlanPrompt({ plan, topic });
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
