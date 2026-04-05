import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./visual-code.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_VISUAL_CODE ?? "openai/gpt-5.4";
const FALLBACK_MODELS = ["google/gemini-3.1-flash-lite-preview", "anthropic/claude-opus-4.6"];

/**
 * Internal schema for AI generation. Uses `lineContent` instead of
 * `line` numbers because models are good at identifying which code
 * line matters but bad at counting line numbers in their own output.
 * The task function computes correct line numbers via string matching
 * before returning the public schema.
 */
const aiAnnotationSchema = z.object({
  lineContent: z.string(),
  text: z.string(),
});

const aiSchema = z
  .object({
    annotations: z.array(aiAnnotationSchema).nullable(),
    code: z.string(),
    language: z.string(),
  })
  .strict();

/**
 * Public output type matching `codeVisualContentSchema`
 * from `@zoonk/core/steps/contract/visual`. Defined as a plain
 * type (not a Zod schema) because it's never parsed — the AI
 * uses `aiSchema` and `generateVisualCode` produces this shape.
 */
export type VisualCodeSchema = {
  annotations: { line: number; text: string }[] | null;
  code: string;
  language: string;
};

export type VisualCodeParams = {
  description: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Finds the 1-based line number where `lineContent` appears in
 * the code. Tries exact match first, then falls back to substring
 * match (trimmed). Returns 1 if no match is found so annotations
 * always have a valid line number.
 */
function resolveLineNumber(code: string, lineContent: string): number {
  const lines = code.split("\n");

  const exactIndex = lines.indexOf(lineContent);

  if (exactIndex !== -1) {
    return exactIndex + 1;
  }

  const trimmed = lineContent.trim();
  const substringIndex = lines.findIndex((line) => line.trim().includes(trimmed));

  if (substringIndex !== -1) {
    return substringIndex + 1;
  }

  return 1;
}

/**
 * Generates structured code snippet data from a textual description.
 * Takes a visual description (from a kind-selection task like
 * `generateInvestigationVisual`) and produces code content
 * matching `codeVisualContentSchema`: the code snippet,
 * programming language, and optional line annotations.
 *
 * Internally, the AI generates `lineContent` (a substring of the
 * target line) instead of line numbers. This function then computes
 * the correct 1-based line numbers via string matching, since models
 * are good at identifying which line matters but bad at counting.
 */
export async function generateVisualCode({
  description,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: VisualCodeParams) {
  const userPrompt = `
    VISUAL_DESCRIPTION: ${description}
    ANNOTATION_LANGUAGE: ${language}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
    reasoningEffort,
    useFallback,
  });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema: aiSchema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  const annotations = output.annotations
    ? output.annotations.map((annotation) => ({
        line: resolveLineNumber(output.code, annotation.lineContent),
        text: annotation.text,
      }))
    : null;

  const data: VisualCodeSchema = {
    annotations,
    code: output.code,
    language: output.language,
  };

  return { data, systemPrompt, usage, userPrompt };
}
