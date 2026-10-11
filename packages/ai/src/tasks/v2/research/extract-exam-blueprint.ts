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

/**
 * One thing a written section asks ("two discursive questions of up to 20 lines"), or one recording
 * part of a listening section ("Part 1: a conversation in an everyday context, form completion"),
 * with how many times that recording is played; `plays` is null for written tasks and when the
 * notice doesn't say. It quotes every passage it comes from, the line that states the task or
 * part itself first (its claims name it by that line): a format page states a part, its setting,
 * its questions and its plays in separate sentences, some about several parts at once ("Parts 1
 * and 2 deal with everyday, social situations"), away from the section's summary.
 */
const writtenTaskSchema = z.object({
  ...citedMany,
  count: z.number().int(),
  description: z.string(),
  plays: z.number().int().nullable(),
});

/**
 * The scale the result is reported on, as the notice states it (a range, its step and the score
 * that passes), with `fromPercent` only where the notice publishes a linear conversion from the
 * share of right answers; null when it states no scale.
 */
const scaleSchema = z.object({
  fromPercent: z.object({ base: z.number(), perPercent: z.number() }).nullable(),
  max: z.number(),
  min: z.number(),
  name: z.string().nullable(),
  passScore: z.number().nullable(),
  step: z.number().nullable(),
});

/**
 * How candidates move through a section, when the notice says: never back to a question once
 * left, a clock per question, an answer before the next one shows, and how many answers the
 * review at its end may change.
 */
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
        /**
         * For `wrongCancelsRight`, the share of a right answer's points a wrong one takes away (1,
         * or 0.25 for +4 and -1); null when the notice gives no numbers or wrong answers cost none.
         */
        wrongPenalty: z.number().nullable(),
      }),
      sections: z.array(
        z.object({
          /**
           * The lines the section's questions, minutes and details come from: a format page
           * states them under the section's own heading, away from the exam's summary.
           */
          ...citedMany,
          /** The break the notice gives after this section, before the next, in minutes. */
          breakAfterMinutes: z.number().int().nullable(),
          day: z.number().int().nullable(),
          /**
           * `written`: answered in writing (a discursive test, an essay, a legal brief);
           * `listening`, `speaking` and `practical` for tests of those kinds.
           */
          kind: z.enum(["objective", "written", "listening", "speaking", "practical"]),
          minutes: z.number().int().nullable(),
          name: z.string(),
          navigation: navigationSchema.nullable(),
          questions: z.number().int().nullable(),
          /**
           * What a written section asks, or a listening section's recording parts, as the notice
           * says them; empty for an objective one.
           */
          tasks: z.array(writtenTaskSchema),
          /** What may be used or is given in the section, in one sentence of the notice's. */
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
      /** `passMark`: what it takes to pass, so it can be said once where learners look for it. */
      kind: z.enum(["passMark", "other"]),
      text: z.string(),
    }),
  ),
  subjects: z.array(
    z.object({
      ...citedMany,
      /**
       * The choice the subject is an option of, when candidates take only one of several subjects
       * (ENEM's foreign language: English or Spanish); null otherwise.
       */
      choiceGroup: z.string().nullable(),
      /** The part of the exam the notice puts the subject in, such as its basic knowledge (P1). */
      group: z.string().nullable(),
      /**
       * A skills matrix's competency and ability statements, when the topics are the contents
       * it's paired with (ENEM's "objects of knowledge"); empty otherwise.
       */
      matrix: z.array(z.string()),
      name: z.string(),
      /** The subject whose question count includes this one's (an option inside ENEM's languages). */
      partOf: z.string().nullable(),
      questions: z.number().int().nullable(),
      /** What learners call the subject when its name is long, such as "Constitutional Law". */
      shortName: z.string(),
      /**
       * The headings the syllabus puts the subject's topics under (ENEM's physics, chemistry and
       * biology in natural sciences), each with the first of `topics` under it; empty when it
       * lists them without headings.
       */
      topicHeadings: z.array(topicHeadingSchema),
      topics: z.array(z.string()),
      weight: z.number().nullable(),
    }),
  ),
  /**
   * The language the exam certifies or measures candidates' command of (IELTS and PTE Academic:
   * English), as an ISO 639-1 code; null when it tests subjects, a language among them included.
   */
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

/**
 * What the check of an earlier reading of the same documents found it left out (see
 * `checkExamReading`): a subject they name as part of the exam, a subject's count they state,
 * counts that don't add up to the exam's questions, or what it stated that no check could confirm
 * from what it quoted (`unconfirmed`: the result's scale, the exam's day or a subject's topics).
 * `document` is the document's number.
 */
export type ReadingCorrection =
  | { document: number; kind: "missingSubject"; name: string; passage: string }
  | { document: number; kind: "missingCount"; passage: string; questions: number; subject: string }
  | { kind: "countsOffTotal"; sum: number; total: number }
  | { kind: "unconfirmed"; part: "examDate" | "scale" | "topics"; subject: string | null };

export type ExtractExamBlueprintParams = {
  /** The exam's canonical name and role, such as "Banco do Brasil, Clerk". */
  exam: string;
  documents: ResearchDocument[];
  /** What an earlier reading left out, for a reading again that includes it. */
  corrections?: ReadingCorrection[];
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
 * reading missed; that narrow read failing leaves the reading as it is. Its own
 * provenance (`formatsProvenance`, null when it failed) sends its own event; an
 * eval adds it to what the reading spent.
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

/** A reading the provider stopped for its content, which another model may finish. */
class ContentFilteredError extends Error {
  constructor(model: string) {
    super(`${model} stopped the blueprint reading for its content.`);
    this.name = "ContentFilteredError";
  }
}

/** What a reading stated that no check could confirm, and how to state it so a check can. */
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

/**
 * A reading again reads what the check found left out (`LEFT_OUT`) with its own rules after the
 * usual ones; a first reading gets the usual rules alone.
 */
function getInstructions(corrections: readonly ReadingCorrection[]): string {
  return corrections.length > 0 ? `${systemPrompt}\n${readingAgainPrompt}` : systemPrompt;
}

/** What an earlier reading left out, after the documents: it changes with every reading. */
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
