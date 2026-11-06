import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";
import {
  type ConversationTurn,
  formatConversationTranscript,
} from "../language/_utils/conversation-transcript";
import promptTemplate from "./memory-extraction.prompt.md";
import { type MemoryFactCategory, memoryCategorySchema } from "./memory-facts";

/** Luna tied Gemini 3.8 Flash on the memory-extraction eval at a sixteenth of the cost. */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

/** A call teaches memory only about the learner's life, never how they study or speak. */
const CALL_CATEGORIES: ReadonlySet<MemoryFactCategory> = new Set([
  "goals",
  "background",
  "routine",
  "context",
]);

const extractedFactSchema = z.object({
  category: memoryCategorySchema,
  evidence: z.string(),
  expiresOn: z.string().nullable(),
  intent: z.enum(["remember", "forget"]),
  origin: z.enum(["said", "noticed"]),
  statement: z.string(),
});

const schema = z.object({ facts: z.array(extractedFactSchema) });

export type ExtractedMemoryFact = z.infer<typeof extractedFactSchema>;
export type MemoryExtractionSchema = z.infer<typeof schema>;

/** The scene as the learner saw it, so what it asked of them isn't taken for their life. */
export type MemoryCallInput = {
  source: "call";
  /** In the learner's language: what they were told to do. */
  scenario: { situation: string; objectives: string[] };
  targetLanguage: string;
  /** Learner turns are untrusted input. */
  turns: readonly ConversationTurn[];
};

type MemoryWrittenInput = { source: "onboarding" | "chat"; input: string };

export type MemoryExtractionInput = MemoryCallInput | MemoryWrittenInput;

export type MemoryExtractionParams = MemoryExtractionInput & {
  language: string;
  /** To resolve "next Friday" into an expiry date. */
  today: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function buildCallLines(params: MemoryCallInput & { language: string }): string[] {
  const practiced = getPromptLanguageName({
    language: params.targetLanguage,
    userLanguage: params.language,
  });

  return [
    `PRACTICED_LANGUAGE: ${practiced}`,
    `SITUATION: ${params.scenario.situation}`,
    "TASKS:",
    ...params.scenario.objectives.map((objective) => `- ${objective}`),
    formatUntrustedInput({
      INPUT: formatConversationTranscript({
        labels: { character: "Character", learner: "Learner" },
        turns: params.turns,
      }),
    }),
  ];
}

function buildUserPrompt(params: MemoryExtractionParams) {
  const header = [
    `LANGUAGE: ${getPromptLanguageName({ language: params.language })}`,
    `SOURCE: ${params.source}`,
    `TODAY: ${params.today}`,
  ];

  const input =
    params.source === "call"
      ? buildCallLines(params)
      : [formatUntrustedInput({ INPUT: params.input })];

  return [...header, ...input].join("\n");
}

function keepCallFacts(facts: ExtractedMemoryFact[]): ExtractedMemoryFact[] {
  return facts.filter((fact) => fact.origin === "said" && CALL_CATEGORIES.has(fact.category));
}

/**
 * Favors recall on what is lasting: the gate drops passing and sensitive facts, and reconciling
 * compares each one with what memory already holds.
 */
export async function extractMemoryFacts({
  analytics,
  model = defaultModel,
  reasoning,
  useFallback = true,
  ...params
}: MemoryExtractionParams) {
  const isCall = params.source === "call";

  const systemPrompt = selectPromptVariants({
    template: promptTemplate,
    variants: { call: isCall, written: !isCall },
  });

  const userPrompt = buildUserPrompt(params);
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
    task: "memory-extraction",
  });

  const facts = isCall ? keepCallFacts(result.output.facts) : result.output.facts;

  return { data: { facts }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
