import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { selectPromptVariants } from "../../_utils/prompt-variants";
import {
  type EssayCriterionDefinition,
  buildEssayGrade,
  buildTooShortEssayGrade,
  getEssayCriteria,
  isEssayTooShort,
} from "./grade-essay-rules";
import promptTemplate from "./grade-essay.prompt.md";

/**
 * On the grade-essay eval, Flash, Sonnet and Opus put every total in its band while Luna and Sol
 * scored an error-filled essay a level too high; Flash was the fastest and cheapest (Sep 2026).
 */
const defaultModel = "google/gemini-3.8-flash";
const fallbackModels = ["anthropic/claude-opus-5.5", "openai/gpt-6-sol"] as const;

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
  return selectPromptVariants({
    template: promptTemplate,
    variants: {
      ap: rubric.kind === "ap",
      custom: rubric.kind === "custom",
      enem: rubric.kind === "enem",
      oab: rubric.kind === "oab",
    },
  });
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
  const { analytics, essay, model = defaultModel, reasoning, rubric, useFallback = true } = params;
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
