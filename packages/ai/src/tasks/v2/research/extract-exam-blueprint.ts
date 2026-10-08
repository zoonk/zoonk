import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { Output, streamText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { startTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import systemPrompt from "./extract-exam-blueprint.prompt.md";
import {
  extractQuestionFormats,
  mergeQuestionFormats,
  questionFormatSchema,
} from "./extract-question-formats";
import { getReadingReasoning } from "./reading-reasoning";
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

/**
 * How a stream ends when the provider stops it for its content: Gemini ends a reading that copies
 * a long syllabus or passage word for word as a recitation (the Câmara notice's 180 topics, twice
 * in three readings on 5 Oct 2026). The gateway only falls back on errors, so the task reads the
 * documents again with the next model.
 */
const CONTENT_FILTER = "content-filter";

/** A heading of the syllabus over some of a subject's topics, and the first topic under it. */
const topicHeadingSchema = z.object({ firstTopic: z.string(), name: z.string() });

/** One thing a written section asks ("2 questões discursivas de até 20 linhas"). */
const writtenTaskSchema = z.object({ count: z.number().int(), description: z.string() });

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
  formats: z.array(questionFormatSchema),
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
          /** `written`: answered in writing (a discursive test, a redação, a peça técnica). */
          kind: z.enum(["objective", "written"]),
          minutes: z.number().int().nullable(),
          name: z.string(),
          questions: z.number().int().nullable(),
          /** What a written section asks, as the notice says it; empty for an objective one. */
          tasks: z.array(writtenTaskSchema),
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
  rules: z.array(
    z.object({
      ...cited,
      /** `passMark`: what it takes to pass, so it can be said once where learners look for it. */
      kind: z.enum(["passMark", "other"]),
      text: z.string(),
    }),
  ),
  subjects: z.array(
    z.object({
      ...citedMany,
      /** The part of the exam the notice puts the subject in, such as "Conhecimentos básicos (P1)". */
      group: z.string().nullable(),
      /**
       * A skills matrix's competência and habilidade statements, when the topics are the contents
       * it's paired with (ENEM's "objetos de conhecimento"); empty otherwise.
       */
      matrix: z.array(z.string()),
      name: z.string(),
      questions: z.number().int().nullable(),
      /** What learners call the subject when its name is long, such as "Direito Constitucional". */
      shortName: z.string(),
      /**
       * The headings the syllabus puts the subject's topics under (ENEM's Física, Química and
       * Biologia in Ciências da Natureza), each with the first of `topics` under it; empty when it
       * lists them without headings.
       */
      topicHeadings: z.array(topicHeadingSchema),
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
  /** The gateway tier it answers at (see `ServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  analytics?: AiGenerationContext;
};

/**
 * Reads an exam's documents (the notice and its corrections, the syllabus,
 * past papers) into a blueprint where every fact quotes its passage. It never
 * fills a gap from the model's own knowledge; the caller checks each fact
 * against its passage and asks the learner for the notice when too little is
 * left. A reading the provider stops for its content is read again with the
 * next model (see `CONTENT_FILTER`). The exam's question formats are also read
 * on their own, at the same time (`extractQuestionFormats`), and fill what the
 * reading missed; that narrow read failing leaves the reading as it is.
 */
export async function extractExamBlueprint(
  params: ExtractExamBlueprintParams,
): Promise<Awaited<ReturnType<typeof readBlueprint>>> {
  const [reading, formats] = await Promise.all([
    readWithFallback(params),
    safeAsync(() =>
      extractQuestionFormats({
        analytics: params.analytics,
        documents: params.documents,
        exam: params.exam,
        model: params.model,
        serviceTier: params.serviceTier,
        useFallback: params.useFallback,
      }),
    ),
  ]);

  const found = formats.data?.data ?? [];

  return {
    ...reading,
    data: { ...reading.data, formats: mergeQuestionFormats({ found, read: reading.data.formats }) },
  };
}

async function readWithFallback(
  params: ExtractExamBlueprintParams,
): Promise<Awaited<ReturnType<typeof readBlueprint>>> {
  const { model = defaultModel, useFallback = true } = params;
  const read = await safeAsync(() => readBlueprint({ ...params, model, useFallback }));

  if (read.data) {
    return read.data;
  }

  const next = useFallback ? fallbackModels.find((candidate) => candidate !== model) : undefined;

  if (read.error instanceof ContentFilteredError && next) {
    return readBlueprint({ ...params, model: next, useFallback: false });
  }

  throw read.error;
}

/** A reading the provider stopped for its content, which another model may finish. */
class ContentFilteredError extends Error {
  constructor(model: string) {
    super(`${model} stopped the blueprint reading for its content.`);
    this.name = "ContentFilteredError";
  }
}

async function readBlueprint({
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
    reasoning: getReadingReasoning({ documents, reasoning }),
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
    const finish = await safeAsync(async () => generation.finishReason);

    if (finish.data === CONTENT_FILTER) {
      throw new ContentFilteredError(model);
    }

    // A stream reports the provider's error (a rate limit, say) apart from its own "no output".
    throw streamErrors[0] ?? error;
  }
}
