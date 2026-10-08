import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import systemPrompt from "./extract-question-formats.prompt.md";
import { isSameFormat } from "./format-words";
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

/** One question format an exam uses, quoting the passage that states it. */
export const questionFormatSchema = z.object({
  description: z.string(),
  document: z.number().int(),
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
  passage: z.string(),
});

export type QuestionFormat = z.infer<typeof questionFormatSchema>;

const schema = z.object({ formats: z.array(questionFormatSchema) });

export type ExtractQuestionFormatsParams = {
  documents: ResearchDocument[];
  /** The exam's canonical name and role, such as "Banco do Brasil, Escriturário". */
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
 * notes announce in passing ("vai ter questão de completar a tabela…"), so this narrow read runs
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
  const completed = [
    ...new Set(read.flatMap((format) => completeFormat({ format, found }))),
  ];

  const added = found.filter(
    (format) => !completed.includes(format) && !read.some((other) => isSameFormat(format, other)),
  );

  return [...completed, ...added];
}
