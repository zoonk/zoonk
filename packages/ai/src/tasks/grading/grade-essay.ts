import "server-only";
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
import {
  type EssayCriterionDefinition,
  buildEssayGrade,
  buildTooShortEssayGrade,
  getEssayCriteria,
  isEssayTooShort,
} from "./grade-essay-rules";
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

/**
 * `ap`: each row is worth its own whole points. `custom`: every other written answer, each
 * criterion worth the same share of `maxScore`.
 */
export type EssayRubric =
  | { kind: "enem" }
  | { kind: "oab" }
  | { kind: "ap"; criteria: { criterion: string; description: string; points: number }[] }
  | { kind: "custom"; criteria: { criterion: string; description: string }[]; maxScore: number };

export type EnemInterventionElements = {
  agent: boolean;
  action: boolean;
  means: boolean;
  effect: boolean;
  detail: boolean;
};

export type GradeEssayParams = {
  language: string;
  rubric: EssayRubric;
  prompt: string;
  essay: string;
  keyPoints?: string[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/**
 * An estimate for practice, never an official score. With `zeroReason` `tooShort` no model ran, so
 * comments and the next step are empty and the app shows its own message.
 */
export type EssayGrade = {
  criteria: {
    /** `c1`..`c5` for ENEM, fixed section ids for OAB, `criterion-1`..`n` for AP and custom. */
    id: string;
    /** English name for ENEM and OAB (apps translate by id); the caller's text for custom. */
    name: string;
    score: number;
    maxScore: number;
    comment: string;
    /** Null when the model's quote wasn't found in the essay. */
    quote: string | null;
    /** Null at full marks. */
    example: string | null;
  }[];
  total: { score: number; maxScore: number };
  /** The "Estimated" range shown instead of a single number. */
  range: { low: number; high: number };
  /** Null when every criterion has full marks. */
  nextStep: { criterionId: string; text: string } | null;
  enemInterventionElements: EnemInterventionElements | null;
  /** ENEM annulment cases. When set, every score and the total are 0. */
  zeroReason: "offTopic" | "notArgumentative" | "tooShort" | null;
};

const criterionOutputSchema = z.object({
  comment: z.string(),
  example: z.string().nullable(),
  nextStep: z.string(),
  quote: z.string().nullable(),
  score: z.number(),
});

const interventionElementsSchema = z.object({
  action: z.boolean(),
  agent: z.boolean(),
  detail: z.boolean(),
  effect: z.boolean(),
  means: z.boolean(),
});

/** Keyed by id, so a schema-following model can't skip or repeat one as it could in an array. */
function buildCriteriaSchema(criteria: EssayCriterionDefinition[]) {
  return z.object({
    criteria: z.object(Object.fromEntries(criteria.map(({ id }) => [id, criterionOutputSchema]))),
  });
}

const enemOutputSchema = z.object({
  interventionElements: interventionElementsSchema.nullable(),
  proposalLimit: z.enum(["conditional", "tangent", "invalid"]).nullable(),
  zeroReason: z.enum(["offTopic", "notArgumentative"]).nullable(),
});

export type EssayModelOutput = z.infer<ReturnType<typeof buildCriteriaSchema>> &
  Partial<z.infer<typeof enemOutputSchema>>;

function buildOutputSchema({
  criteria,
  rubric,
}: {
  criteria: EssayCriterionDefinition[];
  rubric: EssayRubric;
}): z.ZodType<EssayModelOutput> {
  const schema = buildCriteriaSchema(criteria);
  return rubric.kind === "enem" ? schema.extend(enemOutputSchema.shape) : schema;
}

function getSystemPrompt(rubric: EssayRubric): string {
  const rubricPrompt = selectPromptVariants({
    template: promptTemplate,
    variants: {
      ap: rubric.kind === "ap",
      custom: rubric.kind === "custom",
      enem: rubric.kind === "enem",
      levels: false,
      oab: rubric.kind === "oab",
      points: false,
    },
  });

  return `${rubricPrompt}\n${regionalFormsPrompt}\n${NEUTRAL_ADDRESS_PROMPT}`;
}

function formatCriterion(criterion: EssayCriterionDefinition): string {
  const description = criterion.description ? `: ${criterion.description}` : "";
  return `- ${criterion.id} (${criterion.name}, 0 to ${criterion.maxScore} points)${description}`;
}

function formatKeyPoints(keyPoints: string[] = []): string {
  if (keyPoints.length === 0) {
    return "none";
  }

  return `\n${keyPoints.map((keyPoint, index) => `${index + 1}. ${keyPoint}`).join("\n")}`;
}

function buildUserPrompt({
  criteria,
  params,
}: {
  criteria: EssayCriterionDefinition[];
  params: GradeEssayParams;
}): string {
  const essayBlock = formatUntrustedInput({ ESSAY: params.essay });

  return `
LANGUAGE: ${getPromptLanguageName({ language: params.language })}
RUBRIC: ${params.rubric.kind}
CRITERIA:
${criteria.map((criterion) => formatCriterion(criterion)).join("\n")}
KEY_POINTS: ${formatKeyPoints(params.keyPoints)}
PROMPT:
${params.prompt}

${essayBlock}
  `;
}

/** Code enforces the rubric's rules; texts too short to grade are settled without a model. */
export async function gradeEssay(params: GradeEssayParams) {
  const {
    analytics,
    essay,
    model = defaultModel,
    reasoning = defaultReasoning,
    rubric,
    useFallback = true,
  } = params;

  const criteria = getEssayCriteria(rubric);
  const systemPrompt = getSystemPrompt(rubric);
  const userPrompt = buildUserPrompt({ criteria, params });

  if (isEssayTooShort({ essay, rubric })) {
    return {
      data: buildTooShortEssayGrade(rubric),
      provenance: null,
      systemPrompt,
      usage: null,
      userPrompt,
    };
  }

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: buildOutputSchema({ criteria, rubric }) }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "grade-essay",
  });

  return {
    data: buildEssayGrade({ essay, output: result.output, rubric }),
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt,
  };
}

const evidenceCriterion = z.object({
  comment: z.string(),
  example: z.string().nullable(),
  id: z.string(),
  level: z.enum(["missing", "partial", "strong", "complete"]),
  quote: z.string().nullable(),
});

export const writingEvidenceSchema = z.object({
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
  nextStep: z
    .object({
      criterionId: z.string(),
      example: z.string().nullable(),
      quote: z.string().nullable(),
      text: z.string(),
    })
    .nullable(),
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

export async function gradeWritingEvidence(params: WritingEvidenceParams) {
  const {
    analytics,
    model = defaultModel,
    reasoning = defaultReasoning,
    useFallback = true,
  } = params;

  const kind = params.scoringBasis.kind;

  const rubricPrompt = selectPromptVariants({
    template: promptTemplate,
    variants: {
      ap: false,
      custom: false,
      enem: kind === "enem",
      levels: kind === "levels",
      oab: kind === "oab",
      points: kind === "points",
    },
  });

  // The evidence interface also works with the original score-oriented prompt during rollout.
  const systemPrompt = `${rubricPrompt}\n${regionalFormsPrompt}\n${NEUTRAL_ADDRESS_PROMPT}
For the structured response, report evidence and criterion levels rather than numeric scores.
Use SCORING_BASIS for criterion IDs and the ordered rules, ASPECTS for zero-based aspect indexes,
and exact passages from ESSAY for quotes. Return no final points. Report an error only when
its quote and correction are exact and its usage is unambiguously incorrect in context.`;

  const schema =
    kind === "enem"
      ? writingEvidenceSchema.extend({
          interventionElements: enemOutputSchema.shape.interventionElements,
          proposalLimit: enemOutputSchema.shape.proposalLimit,
        })
      : writingEvidenceSchema;

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
