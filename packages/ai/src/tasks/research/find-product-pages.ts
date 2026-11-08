import "server-only";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { type Reasoning, type ServiceTier } from "../../provider-options";
import { selectPromptVariants } from "../_utils/prompt-variants";
import promptTemplate from "./find-product-pages.prompt.md";
import { type ResearchSearchTool } from "./research-search-tools";
import { runSearchTask } from "./run-search-task";
import { type ProductHints } from "./source-research-plan";

/**
 * With Parallel on 8 cases (8 Nov 2026), Haiku 5.5 scored 9.90 (EN 10.00, PT 9.80) at $10.62/1k
 * against Flash's 10.00 at $19.17/1k; its one miss was a generic product page, and it still found
 * the exact release notes.
 */
const defaultModel = "anthropic/claude-haiku-5.5";
const fallbackModels = ["google/gemini-3.8-flash"] as const;
const defaultSearchTool: ResearchSearchTool = "parallel";

const MAX_STEPS = 8;

const schema = z.object({
  brandUrl: z.string().nullable(),
  docsUrl: z.string().nullable(),
  productUrl: z.string().nullable(),
  releaseUrl: z.string().nullable(),
  releasesUrl: z.string().nullable(),
});

export type ProductPages = z.infer<typeof schema>;

export type FindProductPagesParams = {
  hints: ProductHints;
  officialDomains: readonly string[];
  /** A saved product missing the learner's release: only that release's page is searched. */
  knownWebsite?: string | null;
  searchTool?: ResearchSearchTool;
  useFallback?: boolean;
  model?: string;
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  analytics?: AiGenerationContext;
};

function toUserPrompt({
  hints,
  knownWebsite,
  officialDomains,
}: Pick<FindProductPagesParams, "hints" | "knownWebsite" | "officialDomains">): string {
  return [
    `TODAY: ${new Date().toISOString().slice(0, 10)}`,
    `PRODUCT:\n${JSON.stringify(hints, null, 2)}`,
    `OFFICIAL_DOMAINS: ${officialDomains.join(", ") || "none"}`,
    knownWebsite && `KNOWN_WEBSITE: ${knownWebsite}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Addresses on sites no search returned are dropped, since the model invented them. */
export async function findProductPages({
  analytics,
  hints,
  knownWebsite,
  model = defaultModel,
  officialDomains,
  reasoning,
  searchTool = defaultSearchTool,
  serviceTier,
  useFallback,
}: FindProductPagesParams) {
  const userPrompt = toUserPrompt({ hints, knownWebsite, officialDomains });

  const systemPrompt = selectPromptVariants({
    template: promptTemplate,
    variants: { known: Boolean(knownWebsite), release: hints.release !== null },
  });

  const { isSearched, output, provenance, searchCalls, usage } = await runSearchTask({
    analytics,
    fallbackModels,
    maxSteps: MAX_STEPS,
    model,
    reasoning,
    schema,
    searchTool,
    serviceTier,
    systemPrompt,
    task: "find-product-pages",
    useFallback,
    userPrompt,
  });

  const keep = (url: string | null) => (url && isSearched(url) ? url : null);

  return {
    data: {
      brandUrl: keep(output.brandUrl),
      docsUrl: keep(output.docsUrl),
      productUrl: keep(output.productUrl),
      releaseUrl: keep(output.releaseUrl),
      releasesUrl: keep(output.releasesUrl),
      searchCalls,
    },
    provenance,
    systemPrompt,
    usage,
    userPrompt,
  };
}
