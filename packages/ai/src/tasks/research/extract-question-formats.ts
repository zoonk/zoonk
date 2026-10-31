import "server-only";
import { normalizeString } from "@zoonk/utils/string";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { numericEntrySchema, optionSelectSchema } from "../items/item-schemas";
import systemPrompt from "./extract-question-formats.prompt.md";
import { isSameFormat } from "./format-words";
import { partialCreditSchema } from "./partial-credit";
import { type ResearchDocument, toDocumentParts } from "./research-documents";

/** Low reasoning: a narrow read beside the blueprint reading, so it never adds to the wait. */
const defaultModel = "google/gemini-3.8-flash";
const fallbackModels = ["openai/gpt-6-sol"] as const;
const defaultReasoning: Reasoning = "low";

/** A short read: past this, the blueprint reading's own formats stand alone. */
const FORMATS_TIMEOUT_MS = 120_000;

/**
 * Code works out each format's share from every format's count, so the check only ever reads a
 * number its passage states.
 */
const formatCountSchema = z.object({
  per: z.enum(["exam", "paper", "subject", "section"]),
  unit: z.enum(["questions", "percent"]),
  value: z.number(),
});

export type FormatCount = z.infer<typeof formatCountSchema>;

export const questionFormatSchema = z.object({
  /** Null when not stated, and for written, oral and practical formats. */
  count: formatCountSchema.nullable(),
  /** Copied word for word when the count isn't in `passage`; the count's check reads it. */
  countPassage: z.string().nullable(),
  description: z.string(),
  document: z.number().int(),
  entry: numericEntrySchema.nullable(),
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
  /**
   * Copied word for word when the marking isn't in `passage`; the partial credit's check reads it.
   */
  markingPassage: z.string().nullable(),
  options: z.number().int().nullable(),
  partialCredit: partialCreditSchema.nullable(),
  passage: z.string(),
  /** Empty when the documents ask it in every part of the exam. */
  sections: z.array(z.string()),
  /** Null for one pick. */
  select: optionSelectSchema.nullable(),
});

export type QuestionFormat = z.infer<typeof questionFormatSchema>;

const schema = z.object({ formats: z.array(questionFormatSchema) });

export type ExtractQuestionFormatsParams = {
  documents: ResearchDocument[];
  exam: string;
  model?: string;
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  analytics?: AiGenerationContext;
};

/**
 * Runs beside the blueprint reading and takes the lead on formats: the whole reading drops formats
 * a class's notes announce in passing and runs a practice paper's formats together.
 */
export async function extractQuestionFormats({
  analytics,
  documents,
  exam,
  model = defaultModel,
  reasoning = defaultReasoning,
  serviceTier,
  useFallback = true,
}: ExtractQuestionFormatsParams) {
  const intro = `EXAM: ${exam}\nDOCUMENTS: ${documents.length}`;
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: [
          { content: [{ text: intro, type: "text" }, ...toDocumentParts(documents)], role: "user" },
        ],
        providerOptions,
        reasoning,
        timeout: { totalMs: FORMATS_TIMEOUT_MS },
      }),
    libraryInput: true,
    systemPrompt,
    task: "extract-question-formats",
  });

  return {
    data: result.output.formats,
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt: intro,
  };
}

function nameKind({
  format,
  read,
}: {
  format: QuestionFormat;
  read: readonly QuestionFormat[];
}): QuestionFormat[] {
  if (format.kind !== "other") {
    return [format];
  }

  const named = read.filter(
    (candidate) => candidate.kind !== "other" && isSameFormat(candidate, format),
  );

  return named.length > 0 ? named : [format];
}

function isSameAnswer(first: QuestionFormat, second: QuestionFormat): boolean {
  return first.kind === second.kind && first.select === second.select;
}

/** Only when each read has one format answered this way, so no format takes another's options. */
function fillFromReading({
  format,
  found,
  read,
}: {
  format: QuestionFormat;
  found: readonly QuestionFormat[];
  read: readonly QuestionFormat[];
}): QuestionFormat {
  const [reading, ...others] = read.filter((other) => isSameAnswer(other, format));
  const isOnly = found.filter((other) => isSameAnswer(other, format)).length === 1;

  return reading && others.length === 0 && isOnly
    ? {
        ...format,
        entry: format.entry ?? reading.entry,
        options: format.options ?? reading.options,
      }
    : format;
}

function isSamePassage(first: QuestionFormat, second: QuestionFormat): boolean {
  const [one, two] = [first, second].map((format) => normalizeString(format.passage));

  return (
    first.document === second.document &&
    Boolean(one && two && (one.includes(two) || two.includes(one)))
  );
}

/**
 * One exam's choice formats share words ("choice", "select"), so a reading's format quoting another
 * passage is the same only when it's answered alike.
 */
function covers({ format, other }: { format: QuestionFormat; other: QuestionFormat }): boolean {
  if (other.kind === format.kind && isSamePassage(other, format)) {
    return true;
  }

  if (!isSameFormat(other, format)) {
    return false;
  }

  return (
    format.kind === "other" ||
    other.kind === "other" ||
    (isSameAnswer(other, format) && (format.options === null || other.options === format.options))
  );
}

/** The reading adds only the formats it alone names and the options or entry left unstated. */
export function mergeQuestionFormats({
  found,
  read,
}: {
  found: readonly QuestionFormat[];
  read: readonly QuestionFormat[];
}): QuestionFormat[] {
  const kept = [...new Set(found.flatMap((format) => nameKind({ format, read })))].map((format) =>
    found.includes(format) ? fillFromReading({ format, found, read }) : format,
  );

  const added = read.filter(
    (format) => !kept.includes(format) && !kept.some((other) => covers({ format, other })),
  );

  return [...kept, ...added];
}
