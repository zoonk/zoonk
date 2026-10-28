import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { classify } from "../../../evaluate/classify";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import systemPrompt from "./changing-facts.prompt.md";

const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite"] as const;

const CHANGING_FACTS_TOPICS = ["exam", "regulation", "software", "none"] as const;

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
    regulation: "Current laws, taxes, official procedures or policies that get amended.",
    software: "A named product's current version, features or recommended practices.",
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

/**
 * Jev matched Luna on the `changing-facts` eval (20 of 20) in a third of the time and half the
 * cost; Luna is the fallback.
 */
export async function detectChangingFacts({
  analytics,
  goal,
}: {
  analytics?: AiGenerationContext;
  goal: string;
}): Promise<ChangingFactsTopic> {
  const result = await classify({
    analytics,
    fallbackModel: defaultModel,
    input: toInput({ goal }),
    instructions: systemPrompt,
    // The goal's own text is stored with the goal and goes away with it.
    keepInput: true,
    labels: changingFactsClassifier.labels,
    task: "changing-facts",
  });

  return result.choice;
}
