import "server-only";
import { getPromptVersion } from "@zoonk/utils/prompt-version";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { NEUTRAL_ADDRESS_PROMPT } from "../_utils/address-form";
import { getPromptLanguageName } from "../_utils/prompt-language";
import regionalFormsPrompt from "../_utils/regional-forms.prompt.md";
import promptTemplate from "./grade-essay.prompt.md";

/**
 * The learner waits on the grade, so a fallback must be quick too. On the 108-case eval (25 Nov
 * 2026), Muse Ember at high made all 62 pass/fail calls right at 10 s p50 for $2.98/1k. Gemini
 * 3.8 Flash at low did too in two runs, at 10 s p50 (23 s p95) for $8.75/1k; at high it took
 * 108 s p50 (767 s slowest) for $60/1k. Haiku 5.5 at high made them all at 37 s p50 (82 s p95)
 * for $6.10/1k, and a blind GPT-6.1 Sol read preferred Ember's grading to Haiku's (11 Nov 2026).
 * Gemini 3.5 Flash-Lite and GPT-6 Luna at high scored an off-topic essay instead of giving it the
 * zero it gets.
 */
const defaultModel = "meta/muse-ember";
const defaultReasoning: Reasoning = "high";

const fallbackModels = [
  { model: "google/gemini-3.8-flash", reasoning: "low" },
  "anthropic/claude-haiku-5.5",
] as const;

const writingEvidenceSchema = z.object({
  awards: z.array(
    z.object({
      award: z.int().nonnegative(),
      quote: z.string().nullable(),
      row: z.int().nonnegative(),
    }),
  ),
  criteria: z.array(
    z.object({
      comment: z.string(),
      example: z.string().nullable(),
      id: z.string(),
      quote: z.string().nullable(),
    }),
  ),
  elements: z.array(
    z.object({ part: z.string().nullable(), quote: z.string(), row: z.int().nonnegative() }),
  ),
  errors: z.array(z.object({ correction: z.string(), kind: z.string(), quote: z.string() })),
  limits: z.array(z.object({ limit: z.int().nonnegative(), quote: z.string() })),
  nextStep: z
    .object({
      criterionId: z.string(),
      example: z.string().nullable(),
      quote: z.string().nullable(),
      text: z.string(),
      title: z.string(),
    })
    .nullable(),
  onTopicQuote: z
    .string()
    .nullable()
    .describe(
      "Any exact passage that addresses the theme or its broad subject. Check the whole answer before proposing an off-topic zero. Null if the answer contains no such passage.",
    ),
  zeroKind: z
    .enum(["copiedSupport", "identification", "offTopic", "wrongForm"])
    .nullable()
    .describe(
      "The specific trigger in the selected rule. Leave null for blank text or a line count.",
    ),
  zeroQuote: z
    .string()
    .nullable()
    .describe(
      "An exact passage supporting the nominated rule. For off topic or wrong form, identify the actual topic or form only when the whole answer qualifies. For identification, quote the explicit self-identification or signature line, excluding case names and placeholders. For copied support, quote a whole copied line or contiguous block verbatim from both the answer and support; code checks how much original writing remains. For blank or insufficient lines leave null, since code checks them directly.",
    ),
  zeroRuleIndex: z.int().nonnegative().nullable(),
});

export type WritingEvidence = z.infer<typeof writingEvidenceSchema>;

export type WritingRow = {
  awards: readonly { count?: number; points: number | null; pointsHigh?: number; text: string }[];
  criterionId: string;
  parts?: readonly { id: string; text: string }[];
  text: string;
};

type WritingEvidenceParams = {
  language: string;
  question: string;
  context: string | null;
  text: string;
  criteria: readonly { id: string; text: string }[];
  rows: readonly WritingRow[];
  limits: readonly { criteria: readonly string[]; max: number; text: string }[];
  conventions: readonly string[];
  zeroing: readonly { kinds?: readonly string[]; maxLines?: number | null; text: string }[];
  keyPoints: readonly string[];
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
  analytics?: AiGenerationContext;
};

const systemPrompt = `${promptTemplate}\n${regionalFormsPrompt}\n${NEUTRAL_ADDRESS_PROMPT}`;

export function getWritingGrader() {
  return { model: defaultModel, promptVersion: getPromptVersion({ systemPrompt }) };
}

function numberRows(rows: readonly WritingRow[]) {
  return rows.map(({ awards, ...row }, index) => ({
    row: index,
    ...row,
    awards: awards.map((award, position) => ({ award: position, ...award })),
  }));
}

export async function gradeWritingEvidence(params: WritingEvidenceParams) {
  const {
    analytics,
    model = defaultModel,
    reasoning = defaultReasoning,
    useFallback = true,
  } = params;

  const prompt = [
    `LANGUAGE: ${getPromptLanguageName({ language: params.language })}`,
    formatUntrustedInput({
      CONTEXT: params.context ?? "",
      CONVENTIONS: JSON.stringify(params.conventions),
      CRITERIA: JSON.stringify(params.criteria),
      ESSAY: params.text,
      KEY_POINTS: JSON.stringify(params.keyPoints),
      LIMITS: JSON.stringify(params.limits),
      PROMPT: params.question,
      ROWS: JSON.stringify(numberRows(params.rows)),
      ZEROING: JSON.stringify(params.zeroing),
    }),
  ].join("\n\n");

  const providerOptions = buildProviderOptions({ fallbackModels, model, reasoning, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: writingEvidenceSchema }),
        prompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "grade-essay",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt: prompt };
}
