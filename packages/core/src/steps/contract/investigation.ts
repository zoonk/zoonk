import { z } from "zod";
import { visualStepContentSchema } from "./visual";

const investigationActionQualitySchema = z.enum(["critical", "useful", "weak"]);

const investigationInterpretationQualitySchema = z.enum(["best", "overclaims", "dismissive"]);

const investigationAccuracySchema = z.enum(["best", "partial", "wrong"]);

const investigationExplanationSchema = z
  .object({
    accuracy: investigationAccuracySchema,
    text: z.string(),
  })
  .strict();

/**
 * A single interpretation statement for a finding, written
 * from the perspective of one explanation. The learner picks
 * the "best" reading — the one that carefully acknowledges
 * what the evidence shows and its limitations.
 */
const investigationInterpretationStatementSchema = z
  .object({
    quality: investigationInterpretationQualitySchema,
    text: z.string(),
  })
  .strict();

/**
 * Interpretation set for a finding from one explanation's perspective.
 * Contains 3 statements (best/overclaims/dismissive) and feedback
 * explaining why the best reading is the best.
 */
const investigationInterpretationSetSchema = z
  .object({
    feedback: z.string(),
    statements: z.array(investigationInterpretationStatementSchema),
  })
  .strict();

/**
 * Problem step: presents the scenario, a visual, and a set of possible
 * explanations the learner picks from ("What's your hunch?").
 * Array index is the identifier — no `id` fields.
 */
const investigationProblemContentSchema = z
  .object({
    explanations: z.array(investigationExplanationSchema),
    scenario: z.string(),
    variant: z.literal("problem"),
    visual: visualStepContentSchema,
  })
  .strict();

/**
 * Action step: the full list of actions the learner can choose from.
 * The player filters out already-picked actions using StepAttempts.
 * `quality` indicates how informative the action is for scoring.
 */
const investigationActionItemSchema = z
  .object({
    label: z.string(),
    quality: investigationActionQualitySchema,
  })
  .strict();

const investigationActionContentSchema = z
  .object({
    actions: z.array(investigationActionItemSchema),
    variant: z.literal("action"),
  })
  .strict();

/**
 * Evidence step: all findings indexed by action index.
 * The player shows the finding matching the learner's prior action choice.
 * Each finding has a visual and interpretation sets — one set per
 * explanation, so the player shows the interpretations matching the
 * learner's chosen hunch.
 */
const investigationFindingItemSchema = z
  .object({
    interpretations: z.array(investigationInterpretationSetSchema),
    text: z.string(),
    visual: visualStepContentSchema,
  })
  .strict();

const investigationEvidenceContentSchema = z
  .object({
    findings: z.array(investigationFindingItemSchema),
    variant: z.literal("evidence"),
  })
  .strict();

/**
 * Call step: the learner picks which explanation they believe is correct
 * after investigating. Shows the same explanations from the problem step.
 * The player checks the learner's pick against each explanation's `accuracy`
 * tier for scoring. `fullExplanation` is the debrief reveal shown after
 * the learner commits.
 */
const investigationCallContentSchema = z
  .object({
    explanations: z.array(investigationExplanationSchema),
    fullExplanation: z.string(),
    variant: z.literal("call"),
  })
  .strict();

export const investigationContentSchema = z.discriminatedUnion("variant", [
  investigationProblemContentSchema,
  investigationActionContentSchema,
  investigationEvidenceContentSchema,
  investigationCallContentSchema,
]);

/**
 * Score screen for an investigation activity (static step).
 * Three dimensions: investigation + analysis + final call.
 * Scoring thresholds are derived from step data at runtime — no content needed.
 */
export const staticInvestigationScoreContentSchema = z
  .object({
    variant: z.literal("investigationScore"),
  })
  .strict();

export type InvestigationStepContent = z.infer<typeof investigationContentSchema>;
