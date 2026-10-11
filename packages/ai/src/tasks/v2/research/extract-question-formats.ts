import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { numericEntrySchema, optionSelectSchema } from "../items/item-schemas";
import systemPrompt from "./extract-question-formats.prompt.md";
import { isSameFormat } from "./format-words";
import { partialCreditSchema } from "./partial-credit";
import { type ResearchDocument, toDocumentParts } from "./research-documents";

/**
 * The blueprint reading's model, at low reasoning: finding a few stated formats is a narrow read,
 * and it runs beside the reading, so it never adds to the learner's wait.
 */
const defaultModel = "google/gemini-3.8-flash";
const fallbackModels = ["openai/gpt-6-sol"] as const;
const defaultReasoning: Reasoning = "low";

/** A short read: past this, the blueprint reading's own formats stand alone. */
const FORMATS_TIMEOUT_MS = 120_000;

/**
 * How many of the exam's questions a format takes, as the documents count them: a number of
 * questions or a percent of them, in the part the count is for (the whole exam, each paper, each
 * subject or a section). Code works out each format's share from every format's count, so the
 * check only ever reads a number its passage states.
 */
const formatCountSchema = z.object({
  per: z.enum(["exam", "paper", "subject", "section"]),
  unit: z.enum(["questions", "percent"]),
  value: z.number(),
});

export type FormatCount = z.infer<typeof formatCountSchema>;

/** One question format an exam uses, quoting the passage that states it. */
export const questionFormatSchema = z.object({
  /**
   * An objective format's count, when the documents state how many questions take it (JEE Main's
   * 20 multiple-choice and 5 numeric questions in each subject); null otherwise and for written,
   * oral and practical formats. Code works out its share (`getFormatShares` in `@zoonk/core`).
   */
  count: formatCountSchema.nullable(),
  /**
   * Where the documents count this format's questions, when that isn't in `passage`, copied word
   * for word with what ties the count to the format; null otherwise. The count's check reads it.
   */
  countPassage: z.string().nullable(),
  description: z.string(),
  document: z.number().int(),
  /** Numeric: how the answer is entered, when stated (a whole number, n decimals, a fraction). */
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
   * Where the documents state how a question with several picks earns part of its marks, when
   * that isn't in `passage` (a marking scheme, a "how it's scored" note), copied word for word;
   * null otherwise. The partial credit's own check reads it.
   */
  markingPassage: z.string().nullable(),
  options: z.number().int().nullable(),
  /** Several picks: how a question answered partly right scores, when stated (`partialCredit`). */
  partialCredit: partialCreditSchema.nullable(),
  passage: z.string(),
  /** Multiple choice: how many options a question asks to pick, when stated; null for one. */
  select: optionSelectSchema.nullable(),
});

export type QuestionFormat = z.infer<typeof questionFormatSchema>;

const schema = z.object({ formats: z.array(questionFormatSchema) });

export type ExtractQuestionFormatsParams = {
  documents: ResearchDocument[];
  /** The exam's canonical name and role, such as "Banco do Brasil, Clerk". */
  exam: string;
  model?: string;
  reasoning?: Reasoning;
  /** The gateway tier it answers at (see `chooseServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  analytics?: AiGenerationContext;
};

/**
 * Lists the question formats an exam's documents state, each quoting its passage, in a call of
 * its own: the blueprint reading extracts everything at once and sometimes drops formats a class's
 * notes announce in passing ("there will be a fill-in-the-table question…"), so this narrow read runs
 * beside it and its formats fill what the reading missed (`mergeQuestionFormats`).
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

/**
 * The read format as the narrow read completes it: its number of options when only the narrow
 * read states them, or, for one the reading called `other`, every format the narrow read names
 * that asks the same thing (a reading may write the table and the essay of one announcement as
 * one `other`).
 */
function completeFormat({
  format,
  found,
}: {
  format: QuestionFormat;
  found: readonly QuestionFormat[];
}): QuestionFormat[] {
  if (format.kind === "other") {
    const named = found.filter(
      (candidate) => candidate.kind !== "other" && isSameFormat(candidate, format),
    );

    return named.length > 0 ? named : [format];
  }

  const withOptions =
    format.options === null
      ? found.find((candidate) => candidate.kind === format.kind && candidate.options !== null)
      : undefined;

  return [withOptions ?? format];
}

/**
 * Every format either read found. A format the reading already has keeps the reading's entry,
 * unless the narrow read states its number of options and the reading doesn't, or the reading
 * called it `other` and the narrow read names its kind; a format of the same kind that asks
 * something else is a format of its own, so two different tasks of one kind both stay.
 */
export function mergeQuestionFormats({
  found,
  read,
}: {
  found: readonly QuestionFormat[];
  read: readonly QuestionFormat[];
}): QuestionFormat[] {
  const completed = [...new Set(read.flatMap((format) => completeFormat({ format, found })))];

  const added = found.filter(
    (format) => !completed.includes(format) && !read.some((other) => isSameFormat(format, other)),
  );

  return [...completed, ...added];
}
