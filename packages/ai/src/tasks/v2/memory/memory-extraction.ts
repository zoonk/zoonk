import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./memory-extraction.prompt.md";
import { type MemoryFactCategory, memoryCategorySchema } from "./memory-facts";

/**
 * A background call after every chat, session and onboarding. In the memory-extraction eval Luna
 * and Gemini 3.8 Flash tied at the top and Luna costs a sixteenth as much.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

const MEMORY_SOURCES = ["onboarding", "chat", "session"] as const;

type MemorySourceKind = (typeof MEMORY_SOURCES)[number];

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

export type MemoryExtractionParams = {
  /** The learner's language; statements are written in it. */
  language: string;
  source: MemorySourceKind;
  /** The learner-local date as YYYY-MM-DD, to resolve "next Friday" into an expiry date. */
  today: string;
  /** The categories this learner's memory may hold (minors keep only goals and learning). */
  categories: readonly MemoryFactCategory[];
  /** What the learner said or did, already formatted by the caller. */
  input: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function buildUserPrompt({ categories, input, language, source, today }: MemoryExtractionParams) {
  return [
    `LANGUAGE: ${getPromptLanguageName({ language })}`,
    `SOURCE: ${source}`,
    `TODAY: ${today}`,
    `CATEGORIES: ${categories.join(", ")}`,
    formatUntrustedInput({ INPUT: input }),
  ].join("\n");
}

/**
 * Proposes candidate facts from what a learner said or did. It favors recall on what is lasting:
 * the gate drops passing and sensitive facts and reconciling compares each one with what memory
 * already holds.
 */
export async function extractMemoryFacts({
  analytics,
  model = defaultModel,
  reasoning,
  useFallback = true,
  ...params
}: MemoryExtractionParams) {
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

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
