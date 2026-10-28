import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { Output, type TextPart, streamText } from "ai";
import { z } from "zod";
import { toDeadlineError } from "../../../evaluate/evaluation-timeout";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { startTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import readingAgainPrompt from "./extract-exam-blueprint-reading-again.prompt.md";
import systemPrompt from "./extract-exam-blueprint.prompt.md";
import {
  extractQuestionFormats,
  mergeQuestionFormats,
  questionFormatSchema,
} from "./extract-question-formats";
import { getReadingReasoning } from "./reading-reasoning";
import { type ResearchDocument, toDocumentParts } from "./research-documents";

/**
 * Flash read 32 of 32 facts on the extract-exam-blueprint eval; Gemini 4 Argon scored a little
 * higher at nearly twice the price (13 Oct 2026). Both stop on recitation now and then, which falls
 * back to Sol.
 */
const defaultModel = "google/gemini-3.8-flash";
const fallbackModels = ["openai/gpt-6-sol", "anthropic/claude-opus-5.5"] as const;

const cited = { document: z.number().int(), passage: z.string() };

/** Facts a notice states in several places cite each passage. */
const citedMany = { passages: z.array(z.object(cited)) };

/**
 * The reading streams, so a long one never waits on response headers (three SAT readings hit the
 * five-minute header timeout). Its length follows the provider's speed, so one that sends nothing
 * this long has stalled and the step retries it.
 */
const READING_TIMEOUT = { chunkMs: 60_000, firstChunkMs: 150_000 };

/**
 * Gemini ends a reading that copies a long syllabus word for word as a recitation (5 Oct 2026). The
 * gateway only falls back on errors, so the task reads the documents again with the next model.
 */
const CONTENT_FILTER = "content-filter";

const topicHeadingSchema = z.object({ firstTopic: z.string(), name: z.string() });

/**
 * `plays` is null for written tasks and when the notice doesn't say. It quotes every passage it
 * comes from, the line that states the task first, since a format page states a part's details in
 * separate sentences.
 */
const writtenTaskSchema = z.object({
  ...citedMany,
  count: z.number().int(),
  description: z.string(),
  plays: z.number().int().nullable(),
});

/**
 * `fromPercent` only where the notice publishes a linear conversion from the share of right
 * answers; null when it states no scale.
 */
const scaleSchema = z.object({
  fromPercent: z.object({ base: z.number(), perPercent: z.number() }).nullable(),
  max: z.number(),
  min: z.number(),
  name: z.string().nullable(),
  passScore: z.number().nullable(),
  step: z.number().nullable(),
});

const navigationSchema = z.object({
  answerChanges: z.number().int().nullable(),
  forwardOnly: z.boolean(),
  itemSeconds: z.number().int().nullable(),
  mustAnswer: z.boolean(),
});

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
        /** The result depends on the other candidates (a percentile, a standardized score). */
        relative: z.boolean(),
        scale: scaleSchema.nullable(),
        /** For `wrongCancelsRight` (0.25 for +4 and -1); null when the notice gives no numbers. */
        wrongPenalty: z.number().nullable(),
      }),
      sections: z.array(
        z.object({
          ...citedMany,
          breakAfterMinutes: z.number().int().nullable(),
          day: z.number().int().nullable(),
          kind: z.enum(["objective", "written", "listening", "speaking", "practical"]),
          minutes: z.number().int().nullable(),
          name: z.string(),
          navigation: navigationSchema.nullable(),
          questions: z.number().int().nullable(),
          /** Empty for an objective section. */
          tasks: z.array(writtenTaskSchema),
          tools: z.string().nullable(),
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
      /** `passMark` is said once where learners look for it. */
      kind: z.enum(["passMark", "other"]),
      text: z.string(),
    }),
  ),
  subjects: z.array(
    z.object({
      ...citedMany,
      /** For one of several subjects candidates pick from (ENEM's foreign language); else null. */
      choiceGroup: z.string().nullable(),
      group: z.string().nullable(),
      /** When the topics are a skills matrix's paired contents (ENEM's); empty otherwise. */
      matrix: z.array(z.string()),
      name: z.string(),
      /** The subject whose question count includes this one's. */
      partOf: z.string().nullable(),
      questions: z.number().int().nullable(),
      /** What learners call a long-named subject. */
      shortName: z.string(),
      /** Each with the first of `topics` under it; empty when the syllabus has no headings. */
      topicHeadings: z.array(topicHeadingSchema),
      topics: z.array(z.string()),
      weight: z.number().nullable(),
    }),
  ),
  /** Null when the exam tests subjects, a language among them included. */
  testedLanguage: z.object({ ...cited, language: z.string() }).nullable(),
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

/** `unconfirmed`: what a reading stated that no check could confirm from what it quoted. */
export type ReadingCorrection =
  | { document: number; kind: "missingSubject"; name: string; passage: string }
  | { document: number; kind: "missingCount"; passage: string; questions: number; subject: string }
  | { kind: "countsOffTotal"; sum: number; total: number }
  | { kind: "unconfirmed"; part: "examDate" | "scale" | "topics"; subject: string | null };

export type ExtractExamBlueprintParams = {
  exam: string;
  documents: ResearchDocument[];
  corrections?: ReadingCorrection[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  analytics?: AiGenerationContext;
};

/**
 * Never fills a gap from the model's own knowledge. The question formats are read on their own at
 * the same time and fill what the reading missed; that read failing leaves the reading as it is.
 */
export async function extractExamBlueprint(
  params: ExtractExamBlueprintParams,
): Promise<
  Awaited<ReturnType<typeof readBlueprint>> & {
    formatsProvenance: Awaited<ReturnType<typeof extractQuestionFormats>>["provenance"] | null;
  }
> {
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
    formatsProvenance: formats.data?.provenance ?? null,
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

class ContentFilteredError extends Error {
  constructor(model: string) {
    super(`${model} stopped the blueprint reading for its content.`);
    this.name = "ContentFilteredError";
  }
}

function describeUnconfirmed(
  correction: Extract<ReadingCorrection, { kind: "unconfirmed" }>,
): string {
  if (correction.part === "topics") {
    return `- The topics of "${correction.subject}": none is in the documents word for word. Copy each item as the syllabus writes it, with a number only where the syllabus gives one.`;
  }

  return correction.part === "scale"
    ? "- The scale the exam's result is reported on: no passage of `mock` states it. Quote in `mock.passages` the sentence that states the scale and the one that states the passing score."
    : "- The exam's day: its passage doesn't state everything its date says. Give it the passage that states the day, and a `label` in that passage's words.";
}

function describeCorrection(correction: ReadingCorrection): string {
  if (correction.kind === "missingSubject") {
    return `- The subject "${correction.name}", named in document ${correction.document}: "${correction.passage}"`;
  }

  if (correction.kind === "missingCount") {
    return `- ${correction.questions} questions for "${correction.subject}", stated in document ${correction.document}: "${correction.passage}"`;
  }

  if (correction.kind === "unconfirmed") {
    return describeUnconfirmed(correction);
  }

  return `- The subjects' questions add up to ${correction.sum}, but the exam has ${correction.total}.`;
}

function getInstructions(corrections: readonly ReadingCorrection[]): string {
  return corrections.length > 0 ? `${systemPrompt}\n${readingAgainPrompt}` : systemPrompt;
}

/** After the documents, since it changes with every reading. */
function toCorrectionParts(corrections: readonly ReadingCorrection[]): TextPart[] {
  if (corrections.length === 0) {
    return [];
  }

  const text = formatUntrustedInput({
    LEFT_OUT: corrections.map((correction) => describeCorrection(correction)).join("\n"),
  });

  return [{ text, type: "text" }];
}

async function readBlueprint({
  analytics,
  corrections = [],
  documents,
  exam,
  model = defaultModel,
  reasoning,
  serviceTier,
  useFallback = true,
}: ExtractExamBlueprintParams) {
  const intro = `EXAM: ${exam}\nDOCUMENTS: ${documents.length}`;
  const instructions = getInstructions(corrections);
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const run = startTaskGeneration({
    analytics,
    systemPrompt: instructions,
    task: "extract-exam-blueprint",
  });

  const streamErrors: unknown[] = [];

  const generation = streamText({
    instructions,
    model,
    onError: ({ error }) => {
      streamErrors.push(error);
    },
    output: Output.object({ schema: extractionSchema }),
    prompt: [
      {
        content: [
          { text: intro, type: "text" },
          ...toDocumentParts(documents),
          ...toCorrectionParts(corrections),
        ],
        role: "user",
      },
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

    return { data: output, provenance, systemPrompt: instructions, usage, userPrompt: intro };
  } catch (error) {
    const finish = await safeAsync(async () => generation.finishReason);

    if (finish.data === CONTENT_FILTER) {
      throw new ContentFilteredError(model);
    }

    // A stream reports the provider's error (a rate limit, say) apart from its own "no output";
    // the reading's only abort is its own deadline (`READING_TIMEOUT`).
    throw toDeadlineError(streamErrors[0] ?? error);
  }
}
