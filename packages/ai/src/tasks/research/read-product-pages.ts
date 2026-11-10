import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { failFilteredAnswer, failUnfinishedAnswer } from "../_utils/filtered-answer";
import { selectPromptVariants } from "../_utils/prompt-variants";
import { cited } from "./cited-passages";
import promptTemplate from "./read-product-pages.prompt.md";
import { toDocumentParts } from "./research-documents";
import { type ProductHints } from "./source-research-plan";

/**
 * At high reasoning on 12 cases (8 Nov 2026), Luna kept every release and date (10.00) at $2.48/1k
 * and Haiku 5.5 scored 9.86 at $3.23/1k, against Terra's 9.92 at $11.80/1k; at its default
 * reasoning Luna dropped releases from the month-dated pages.
 */
const defaultModel = "openai/gpt-6-luna";
const defaultReasoning: Reasoning = "high";
const fallbackModels = ["anthropic/claude-haiku-5.5"] as const;

const releaseSchema = z.object({
  ...cited,
  name: z.string(),
  releasedOn: z.string().nullable(),
  supportEndsOn: z.string().nullable(),
  version: z.string().nullable(),
});

const releasesSchema = z.object({ releases: z.array(releaseSchema) });

const learnerReleaseSchema = releasesSchema.extend({ learnerRelease: z.string().nullable() });

const productSchema = z.object({
  ...cited,
  aliases: z.array(z.string()),
  description: z.string(),
  name: z.string(),
});

const brandSchema = z.object({
  ...cited,
  description: z.string(),
  name: z.string(),
  steward: z.boolean(),
});

const newProductSchema = learnerReleaseSchema.extend({
  brand: brandSchema.nullable(),
  product: productSchema.nullable(),
});

export type ProductReleaseClaim = z.infer<typeof releaseSchema>;

/** Every name, release and date is a claim until code finds its passage in the cited page. */
export type ProductReading = {
  brand: z.infer<typeof brandSchema> | null;
  learnerRelease: string | null;
  product: z.infer<typeof productSchema> | null;
  releases: ProductReleaseClaim[];
};

type ProductPage = { text: string; title: string; url: string };

export type ReadProductPagesParams = {
  /** Numbered from 1 in this order; claims cite a page by its number. */
  pages: ProductPage[];
  hints: ProductHints;
  /** The product is saved already, so only its releases are read. */
  known?: boolean;
  model?: string;
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  analytics?: AiGenerationContext;
};

function chooseSchema({ hasRelease, known }: { hasRelease: boolean; known: boolean }) {
  if (!known) {
    return newProductSchema;
  }

  return hasRelease ? learnerReleaseSchema : releasesSchema;
}

function toReading(output: Partial<ProductReading> & Pick<ProductReading, "releases">) {
  return {
    brand: output.brand ?? null,
    learnerRelease: output.learnerRelease ?? null,
    product: output.product ?? null,
    releases: output.releases,
  } satisfies ProductReading;
}

/**
 * Hints come from the learner's goal, except a known product's names with no release named: those
 * are stored product data, so only that reading may use any provider (`libraryInput`).
 */
export async function readProductPages({
  analytics,
  hints,
  known = false,
  model = defaultModel,
  pages,
  reasoning = defaultReasoning,
  serviceTier,
  useFallback = true,
}: ReadProductPagesParams) {
  const hasRelease = hints.release !== null;
  const userPrompt = `TODAY: ${new Date().toISOString().slice(0, 10)}\nPRODUCT:\n${JSON.stringify(hints, null, 2)}`;
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const systemPrompt = selectPromptVariants({
    template: promptTemplate,
    variants: { known, new: !known, release: hasRelease },
  });

  const documents = pages.map((page) => ({ ...page, file: null, images: [] }));

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      failUnfinishedAnswer(
        generateText({
          instructions: systemPrompt,
          model,
          output: Output.object({ schema: chooseSchema({ hasRelease, known }) }),
          prompt: [
            {
              content: [{ text: userPrompt, type: "text" }, ...toDocumentParts(documents)],
              role: "user",
            },
          ],
          providerOptions,
          reasoning,
        }),
      ),
    libraryInput: known && !hasRelease,
    systemPrompt,
    task: "read-product-pages",
  });

  failFilteredAnswer(result);

  return {
    data: toReading(result.output),
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt,
  };
}
