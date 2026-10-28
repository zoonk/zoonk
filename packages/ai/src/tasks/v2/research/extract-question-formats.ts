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
 * The blueprint reading sometimes drops formats a class's notes announce in passing, so this narrow
 * read runs beside it and fills what the reading missed.
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
 * For one the reading called `other`, every format the narrow read names that asks the same thing:
 * a reading may write a table and an essay of one announcement as one `other`.
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
 * A format the reading already has keeps its entry unless the narrow read adds its options or names
 * its kind. Two different tasks of one kind both stay.
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
