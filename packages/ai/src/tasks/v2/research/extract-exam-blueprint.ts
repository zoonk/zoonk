import "server-only";
import { Output, streamText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { startTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import systemPrompt from "./extract-exam-blueprint.prompt.md";
import { type ResearchDocument, toDocumentParts } from "./research-documents";

/** The `extract-exam-blueprint` eval on 5 real notices: Flash 32/32 facts, Sol 30/32, Opus 28/32. */
const defaultModel = "google/gemini-3.8-flash";
const fallbackModels = ["openai/gpt-6-sol", "anthropic/claude-opus-5.5"] as const;

/** Where a fact came from: the document's number and the passage quoted from it. */
const cited = { document: z.number().int(), passage: z.string() };

/** Facts a notice states in several places cite each passage. */
const citedMany = { passages: z.array(z.object(cited)) };

/**
 * The reading streams, so a long one never waits on response headers: three SAT readings hit the
 * five-minute header timeout before one answered in 94 s. The same PRF notice (21,000 output
 * tokens, mostly reasoning) took 68 s once and 264 s another time, so a reading's length follows
 * the provider's speed; one that sends nothing for this long has stalled, and the step retries it
 * instead of waiting.
 */
const READING_TIMEOUT = { chunkMs: 60_000, firstChunkMs: 150_000 };

const extractionSchema = z.object({
  dates: z.array(
    z.object({
      ...cited,
      date: z.string(),
      kind: z.enum(["registrationStart", "registrationEnd", "exam", "results", "other"]),
      label: z.string(),
      startTime: z.string().nullable(),
    }),
  ),
  edition: z.object({
    ...citedMany,
    questionCount: z.number().int().nullable(),
    timeZone: z.string().nullable(),
    year: z.number().int().nullable(),
  }),
  formats: z.array(
    z.object({
      ...cited,
      description: z.string(),
      kind: z.enum([
        "multipleChoice",
        "trueFalse",
        "essay",
        "shortAnswer",
        "numeric",
        "oral",
        "practical",
        "other",
      ]),
      options: z.number().int().nullable(),
    }),
  ),
  mock: z
    .object({
      ...citedMany,
      adaptive: z.boolean(),
      order: z.string().nullable(),
      scoring: z.object({
        description: z.string(),
        method: z.enum(["raw", "wrongCancelsRight", "itemResponseTheory", "scaled", "other"]),
      }),
      sections: z.array(
        z.object({
          day: z.number().int().nullable(),
          minutes: z.number().int().nullable(),
          name: z.string(),
          questions: z.number().int().nullable(),
        }),
      ),
      timeLimitMinutes: z.number().int().nullable(),
      totalQuestions: z.number().int().nullable(),
    })
    .nullable(),
  reusePolicy: z.object({
    document: z.number().int().nullable(),
    passage: z.string().nullable(),
    pastQuestions: z.enum(["allowedWithCitation", "notAllowed", "unknown"]),
  }),
  rules: z.array(z.object({ ...cited, text: z.string() })),
  subjects: z.array(
    z.object({
      ...citedMany,
      name: z.string(),
      questions: z.number().int().nullable(),
      topics: z.array(z.string()),
      weight: z.number().nullable(),
    }),
  ),
  topicFrequency: z.array(
    z.object({
      ...cited,
      appearances: z.number().int().nullable(),
      basis: z.string(),
      level: z.enum(["high", "medium", "low"]),
      subject: z.string(),
      topic: z.string(),
    }),
  ),
});

export type BlueprintExtraction = z.infer<typeof extractionSchema>;

export type ExtractExamBlueprintParams = {
  /** The exam's canonical name and role, such as "Banco do Brasil, Escriturário". */
  exam: string;
  documents: ResearchDocument[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  /** `priority` when a learner's plan waits on the reading. */
  serviceTier?: ServiceTier;
  analytics?: AiGenerationContext;
};

/**
 * Reads an exam's documents (the notice and its corrections, the syllabus,
 * past papers) into a blueprint where every fact quotes its passage. It never
 * fills a gap from the model's own knowledge; the caller checks each fact
 * against its passage and asks the learner for the notice when too little is
 * left.
 */
export async function extractExamBlueprint({
  analytics,
  documents,
  exam,
  model = defaultModel,
  reasoning,
  serviceTier,
  useFallback = true,
}: ExtractExamBlueprintParams) {
  const intro = `EXAM: ${exam}\nDOCUMENTS: ${documents.length}`;
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });
  const run = startTaskGeneration({ analytics, systemPrompt, task: "extract-exam-blueprint" });
  const streamErrors: unknown[] = [];

  const generation = streamText({
    instructions: systemPrompt,
    model,
    onError: ({ error }) => {
      streamErrors.push(error);
    },
    output: Output.object({ schema: extractionSchema }),
    prompt: [
      { content: [{ text: intro, type: "text" }, ...toDocumentParts(documents)], role: "user" },
    ],
    providerOptions,
    reasoning,
    timeout: READING_TIMEOUT,
  });

  try {
    const [output, finalStep, steps, usage] = await Promise.all([
      generation.output,
      generation.finalStep,
      generation.steps,
      generation.usage,
    ]);

    const provenance = await run.finish({ finalStep, steps, usage });

    return { data: output, provenance, systemPrompt, usage, userPrompt: intro };
  } catch (error) {
    // A stream reports the provider's error (a rate limit, say) apart from its own "no output".
    throw streamErrors[0] ?? error;
  }
}
