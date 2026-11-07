import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { selectPromptVariants } from "../_utils/prompt-variants";
import { type ResearchTopic, formatResearchGoal, normalizeResearchPlan } from "./research-plan";
import promptTemplate from "./source-research-plan.prompt.md";

/** Flash was cheapest and fastest on the research-plan eval. */
const defaultModel = "google/gemini-3.8-flash";
const fallbackModels = ["openai/gpt-6.1-terra", "anthropic/claude-opus-5.5"] as const;

const schema = z.object({
  country: z.string(),
  language: z.string(),
  name: z.string(),
  officialDomains: z.array(z.string()),
  queries: z.array(z.string()),
  searchTerms: z.array(z.string()),
});

const productHintsSchema = z.object({
  brand: z.string(),
  name: z.string(),
  release: z.string().nullable(),
});

const productSchema = schema.extend({ product: productHintsSchema.nullable() });

/** Search hints from the learner's words: lookups and claim keys, never saved as facts. */
export type ProductHints = z.infer<typeof productHintsSchema>;

export type SourceResearchPlan = z.infer<typeof schema> & { product: ProductHints | null };

export type SourceResearchTopic = Exclude<ResearchTopic, "exam">;

export type SourceResearchPlanParams = {
  goal: string;
  details?: string | null;
  topic: SourceResearchTopic;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** No queries for a subject no university course teaches. */
export async function generateSourceResearchPlan({
  analytics,
  details,
  goal,
  model = defaultModel,
  reasoning,
  topic,
  useFallback = true,
}: SourceResearchPlanParams) {
  const isProduct = topic === "product";
  const userPrompt = `TOPIC: ${topic}\n${formatResearchGoal({ details, goal })}`;
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const systemPrompt = selectPromptVariants({
    template: promptTemplate,
    variants: { product: isProduct },
  });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: isProduct ? productSchema : schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "source-research-plan",
  });

  return {
    data: normalizeResearchPlan<SourceResearchPlan>({ product: null, ...result.output }),
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt,
  };
}
