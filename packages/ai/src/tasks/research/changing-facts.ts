import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { classify } from "../../evaluate/classify";
import { JEV_MODEL_ID } from "../../evaluate/evaluation-models";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./changing-facts.prompt.md";

const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite"] as const;

/**
 * On 35 cases (8 Nov 2026), Decider V1.2 matched Jev on every label (EN 23/23, PT 9/9) at $0.0176
 * against $0.0469 per 1k decisions; Decider Flash called a Jira-versus-Linear comparison a product.
 */
const DECISION_MODEL = "perplexity/pplx-decider-v1.2";

const CHANGING_FACTS_TOPICS = ["exam", "regulation", "product", "none"] as const;

export type ChangingFactsTopic = (typeof CHANGING_FACTS_TOPICS)[number];

const schema = z.object({ topic: z.enum(CHANGING_FACTS_TOPICS) });

export type ChangingFactsSchema = z.infer<typeof schema>;

export type ChangingFactsParams = {
  goal: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function toInput({ goal }: { goal: string }) {
  return { GOAL: goal };
}

export const changingFactsClassifier = {
  instructions: systemPrompt,
  labels: {
    exam: "A specific exam, admission, license or certification set by an organizer.",
    none: "Stable knowledge that can be taught without a dated source.",
    product: "Using or switching to one product its maker sells or promotes as its own.",
    regulation: "Current laws, taxes, official procedures or policies that get amended.",
  } satisfies Record<ChangingFactsTopic, string>,
  toInput,
};

/**
 * Only goals that depend on changing facts are researched; the rest are taught from the Library.
 */
export async function classifyChangingFacts({
  analytics,
  goal,
  model = defaultModel,
  reasoning,
  useFallback = true,
}: ChangingFactsParams) {
  const userPrompt = formatUntrustedInput(toInput({ goal }));
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
    systemPrompt,
    task: "changing-facts",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}

export async function detectChangingFacts({
  analytics,
  goal,
}: {
  analytics?: AiGenerationContext;
  goal: string;
}): Promise<ChangingFactsTopic> {
  const result = await classify({
    analytics,
    fallbackModel: JEV_MODEL_ID,
    input: toInput({ goal }),
    instructions: systemPrompt,
    // The goal's own text is stored with the goal and goes away with it.
    keepInput: true,
    labels: changingFactsClassifier.labels,
    model: DECISION_MODEL,
    task: "changing-facts",
  });

  return result.choice;
}
