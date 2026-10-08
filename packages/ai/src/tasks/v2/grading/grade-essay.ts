import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import {
  type EssayCriterionDefinition,
  buildEssayGrade,
  buildTooShortEssayGrade,
  getEssayCriteria,
  isEssayTooShort,
} from "./grade-essay-rules";
import systemPrompt from "./grade-essay.prompt.md";

/**
 * In the grade-essay eval (9 cases in Portuguese and English: ENEM essays at
 * four levels, an off-topic and a too-short one, Cebraspe, IELTS and an OAB
 * brief; Sep 2026), Flash, Sonnet and Opus put every total in its band and
 * the next step on the expected criterion. Luna and Sol scored the essay full
 * of norm errors one level too high (640 against 320 to 600). Flash was also
 * the fastest (8.9s p50) at about $9 per 1,000 essays; Opus costs $49 and
 * Sonnet takes 34s. On two AP free-response answers scored by rows with their
 * own points (a partial Biology answer and a History long essay with feedback
 * in Portuguese; 27 Sep), Flash put both totals in band and the next step on
 * the expected row.
 */
const defaultModel = "google/gemini-3.8-flash";
const fallbackModels = ["anthropic/claude-opus-5.5", "openai/gpt-6-sol"] as const;

/**
 * The official rubrics this task knows. `ap` scores an AP free-response answer
 * the way AP scoring guidelines do: each row is worth its own whole points.
 * `custom` covers every other written answer (Cebraspe discursive items, school
 * essays, IELTS prompts): each criterion is worth the same share of `maxScore`.
 */
export type EssayRubric =
  | { kind: "enem" }
  | { kind: "oab" }
  | { kind: "ap"; criteria: { criterion: string; description: string; points: number }[] }
  | { kind: "custom"; criteria: { criterion: string; description: string }[]; maxScore: number };

/** The five elements INEP counts in an ENEM intervention proposal (competency 5). */
export type EnemInterventionElements = {
  agent: boolean;
  action: boolean;
  means: boolean;
  effect: boolean;
  detail: boolean;
};

export type GradeEssayParams = {
  /** The learner's language: every comment and next step is written in it. */
  language: string;
  rubric: EssayRubric;
  /** The essay's theme or question, with its motivating texts or case. */
  prompt: string;
  essay: string;
  /** What a full answer must cover, when the item has them (an answer standard). */
  keyPoints?: string[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/**
 * An estimate for practice, never an official score. When `zeroReason` is
 * `tooShort` no model ran, so comments and the next step text are empty and
 * the app shows its own message.
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
    /** An exact passage of the essay, or null when the model's quote wasn't found in it. */
    quote: string | null;
    /** A better version of the passage, in the essay's language. Null at full marks. */
    example: string | null;
  }[];
  total: { score: number; maxScore: number };
  /** The "Estimated" range shown instead of a single number. */
  range: { low: number; high: number };
  /** Exactly one next step, on the criterion with the most points to gain. */
  nextStep: { criterionId: string; text: string };
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

/**
 * Criteria are keyed by id so a schema-following model can't skip or repeat
 * one, which an array allows.
 */
function buildOutputSchema(criteria: EssayCriterionDefinition[]) {
  return z.object({
    criteria: z.object(Object.fromEntries(criteria.map(({ id }) => [id, criterionOutputSchema]))),
    interventionElements: interventionElementsSchema.nullable(),
    zeroReason: z.enum(["offTopic", "notArgumentative"]).nullable(),
  });
}

export type EssayModelOutput = z.infer<ReturnType<typeof buildOutputSchema>>;

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

/**
 * Grades an essay with an official rubric (ENEM competencies, OAB brief
 * sections) or the caller's own criteria. The model scores and comments on
 * each criterion; code enforces the rubric's rules: allowed score steps, the
 * ENEM proposal elements capping competency 5, annulments, totals, the
 * estimated range, quotes that must exist in the essay and the one next step.
 * Texts too short to grade are settled without a model.
 */
export async function gradeEssay(params: GradeEssayParams) {
  const { analytics, essay, model = defaultModel, reasoning, rubric, useFallback = true } = params;
  const criteria = getEssayCriteria(rubric);
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
        output: Output.object({ schema: buildOutputSchema(criteria) }),
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
