import "server-only";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { type Reasoning } from "../../../provider-options";
import { selectPromptVariants } from "../../_utils/prompt-variants";
import promptTemplate from "./find-official-sources.prompt.md";
import {
  type ExamResearchPlan,
  type ResearchSearchPlan,
  type ResearchTopic,
} from "./research-plan";
import { type ResearchSearchTool } from "./research-search-tools";
import { runSearchTask } from "./run-search-task";

/** With Parallel, Flash found every current notice in about 10 seconds, the cheapest that did. */
const defaultModel = "google/gemini-3.8-flash";
const defaultSearchTool: ResearchSearchTool = "parallel";

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

type SearchedPlan = Pick<ResearchSearchPlan, "country" | "name" | "officialDomains" | "queries"> &
  Partial<Pick<ExamResearchPlan, "board" | "edition" | "role">>;

export type FindOfficialSourcesParams = {
  plan: SearchedPlan;
  /** Left out when confirming an upload, whose topic isn't known. */
  topic?: ResearchTopic;
  /** Documents that couldn't be downloaded, which the search looks for on other sites. */
  unreadable?: readonly string[];
  searchTool?: ResearchSearchTool;
  model?: string;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** Picked at runtime: a whole plan also carries fields search never reads. */
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
 * Addresses on sites no search returned are dropped, since the model invented them. No fallback
 * models: each search tool is tied to the model it's measured with.
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

  const systemPrompt = selectPromptVariants({
    template: promptTemplate,
    variants: { unreadable: unreadable.length > 0 },
  });

  const { isSearched, output, provenance, searchCalls, usage } = await runSearchTask({
    analytics,
    libraryInput: true,
    maxSteps: MAX_STEPS,
    model,
    reasoning,
    schema,
    searchTool,
    systemPrompt,
    task: "find-official-sources",
    userPrompt,
  });

  const documents = output.documents
    .filter((document) => isSearched(document.url))
    .slice(0, MAX_DOCUMENTS);

  return {
    data: {
      documents,
      officialFound:
        output.officialFound && documents.some((document) => document.kind === "official"),
      searchCalls,
    },
    provenance,
    systemPrompt,
    usage,
    userPrompt,
  };
}
