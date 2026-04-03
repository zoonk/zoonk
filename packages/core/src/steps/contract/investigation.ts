import { z } from "zod";
import { visualStepContentSchema } from "./visual";

const investigationActionQualitySchema = z.enum(["critical", "useful", "weak"]);

const investigationConclusionQualitySchema = z.enum([
  "overclaims",
  "ignoresEvidence",
  "honest",
  "best",
]);

const investigationCorrectTagSchema = z.enum(["supports", "contradicts", "inconclusive"]);

const investigationExplanationSchema = z
  .object({
    text: z.string(),
  })
  .strict();

/**
 * Problem step: presents the scenario, a visual, and a set of possible
 * explanations the learner must pick from (hypothesis selection).
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
 * The player filters out already-picked actions using array index.
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
 * Finding step: all findings indexed by action index.
 * The player shows the finding matching the learner's prior action choice.
 * `correctTag` is absolute — relative to the problem's truth, not the
 * learner's chosen hypothesis.
 * `feedback` explains why the correct tag applies and why someone might misjudge it.
 */
const investigationFindingItemSchema = z
  .object({
    correctTag: investigationCorrectTagSchema,
    feedback: z.string(),
    text: z.string(),
    visual: visualStepContentSchema,
  })
  .strict();

const investigationFindingContentSchema = z
  .object({
    findings: z.array(investigationFindingItemSchema),
    variant: z.literal("finding"),
  })
  .strict();

/**
 * Conclusion step: a set of conclusion statements of varying quality.
 * `correctExplanationIndex` points back to the correct entry in the
 * problem step's `explanations` array.
 * `fullExplanation` is the 2-3 sentence debrief shown right after the
 * learner commits to a conclusion — the "aha moment."
 */
const investigationConclusionItemSchema = z
  .object({
    quality: investigationConclusionQualitySchema,
    text: z.string(),
  })
  .strict();

const investigationConclusionContentSchema = z
  .object({
    conclusions: z.array(investigationConclusionItemSchema),
    correctExplanationIndex: z.number().int().min(0),
    fullExplanation: z.string(),
    variant: z.literal("conclusion"),
  })
  .strict();

export const investigationContentSchema = z.discriminatedUnion("variant", [
  investigationProblemContentSchema,
  investigationActionContentSchema,
  investigationFindingContentSchema,
  investigationConclusionContentSchema,
]);

/**
 * Score screen for an investigation activity (static step).
 * Approach score + judgment score + conclusion quality label.
 * Scoring thresholds are derived from step data at runtime — no content needed.
 */
export const staticInvestigationScoreContentSchema = z
  .object({
    variant: z.literal("investigationScore"),
  })
  .strict();

export type InvestigationStepContent = z.infer<typeof investigationContentSchema>;
