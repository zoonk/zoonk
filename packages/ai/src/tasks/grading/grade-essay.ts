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
import { selectPromptVariants } from "../_utils/prompt-variants";
import regionalFormsPrompt from "../_utils/regional-forms.prompt.md";
import promptTemplate from "./grade-essay.prompt.md";

/**
 * The learner waits on the grade. At high reasoning on 18 essays run twice (11 Nov 2026), Muse
 * Ember put all 36 totals in their band at 6 s p50 for $1.70/1k, and Haiku 5.5 put 31 (it marks
 * English IELTS essays too low) at 21 s p50 for $2.75/1k. A blind GPT-6.1 Sol read preferred
 * Ember's grading on 11 essays and Haiku's on 3: Haiku docked points for flaws the essays didn't
 * have. Gemini 3.8 Flash at high kept all 11 totals in band on 8 Nov 2026, at $16.59/1k; at
 * default reasoning, Haiku and Flash each missed one.
 */
const defaultModel = "meta/muse-ember";
const defaultReasoning: Reasoning = "high";
const fallbackModels = ["anthropic/claude-haiku-5.5", "google/gemini-3.8-flash"] as const;

const interventionElementsSchema = z.object({
  action: z.boolean(),
  agent: z.boolean(),
  detail: z.boolean(),
  effect: z.boolean(),
  means: z.boolean(),
});

const evidenceCriterion = z.object({
  comment: z.string(),
  example: z.string().nullable(),
  id: z.string(),
  level: z.enum(["missing", "partial", "strong", "complete"]),
  quote: z.string().nullable(),
});

const writingEvidenceSchema = z.object({
  aspects: z.array(
    z.object({
      aspectIndex: z.int().nonnegative(),
      criterionId: z.string(),
      earned: z.boolean(),
      quote: z.string().nullable(),
    }),
  ),
  criteria: z.array(evidenceCriterion),
  errors: z.array(z.object({ correction: z.string(), kind: z.string(), quote: z.string() })),
  interventionElements: interventionElementsSchema.nullable().optional(),
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
  proposalLimit: z.enum(["conditional", "tangent", "invalid"]).nullable().optional(),
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

type WritingEvidenceParams = {
  language: string;
  question: string;
  context: string | null;
  text: string;
  scoringBasis: { kind: "enem" | "oab" | "points" | "levels"; [key: string]: unknown };
  aspects: readonly { criterionId: string; description: string; points: number | null }[];
  keyPoints: readonly string[];
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
  analytics?: AiGenerationContext;
};

function getWritingSystemPrompt(kind: WritingEvidenceParams["scoringBasis"]["kind"]) {
  const rubricPrompt = selectPromptVariants({
    template: promptTemplate,
    variants: {
      enem: kind === "enem",
      levels: kind === "levels",
      oab: kind === "oab",
      points: kind === "points" || kind === "oab",
    },
  });

  return `${rubricPrompt}\n${regionalFormsPrompt}\n${NEUTRAL_ADDRESS_PROMPT}`;
}

export function getWritingGrader(kind: WritingEvidenceParams["scoringBasis"]["kind"]) {
  return {
    model: defaultModel,
    promptVersion: getPromptVersion({ systemPrompt: getWritingSystemPrompt(kind) }),
  };
}

export async function gradeWritingEvidence(params: WritingEvidenceParams) {
  const {
    analytics,
    model = defaultModel,
    reasoning = defaultReasoning,
    useFallback = true,
  } = params;

  const kind = params.scoringBasis.kind;
  const systemPrompt = getWritingSystemPrompt(kind);

  const schema =
    kind === "enem"
      ? writingEvidenceSchema.extend({
          interventionElements: interventionElementsSchema.nullable(),
          proposalLimit: z.enum(["conditional", "tangent", "invalid"]).nullable(),
        })
      : writingEvidenceSchema.omit({ interventionElements: true, proposalLimit: true });

  const prompt = [
    `LANGUAGE: ${getPromptLanguageName({ language: params.language })}`,
    `RUBRIC: ${kind}`,
    formatUntrustedInput({
      ASPECTS: JSON.stringify(params.aspects),
      CONTEXT: params.context ?? "",
      ESSAY: params.text,
      KEY_POINTS: JSON.stringify(params.keyPoints),
      PROMPT: params.question,
      SCORING_BASIS: JSON.stringify(params.scoringBasis),
    }),
  ].join("\n\n");

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "grade-essay",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt: prompt };
}
