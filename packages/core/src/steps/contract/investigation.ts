import { z } from "zod";
import { visualStepContentSchema } from "./visual";

const investigationActionQualitySchema = z.enum(["critical", "useful", "weak"]);

const investigationAccuracySchema = z.enum(["best", "partial", "wrong"]);

const investigationExplanationSchema = z
  .object({
    accuracy: investigationAccuracySchema,
    text: z.string(),
  })
  .strict();

/**
 * Each action carries its own finding data (text + visual) so
 * that evidence travels with the action through server-side shuffle.
 * When the learner checks an action, the finding is shown as feedback.
 */
const investigationActionItemSchema = z
  .object({
    finding: z.string(),
    findingVisual: visualStepContentSchema,
    label: z.string(),
    quality: investigationActionQualitySchema,
  })
  .strict();

/**
 * Problem step: presents the scenario and a visual.
 * Read-only — the learner reads the case and taps "Investigate" to start.
 * No hunch selection.
 */
const investigationProblemContentSchema = z
  .object({
    scenario: z.string(),
    variant: z.literal("problem"),
    visual: visualStepContentSchema,
  })
  .strict();

/**
 * Action step: the full list of actions the learner can choose from.
 * The player filters out already-picked actions using the investigation loop.
 * Each action carries its finding data for the feedback screen.
 * `quality` indicates how informative the action is for scoring.
 */
const investigationActionContentSchema = z
  .object({
    actions: z.array(investigationActionItemSchema),
    variant: z.literal("action"),
  })
  .strict();

/**
 * Call step: the learner picks which explanation they believe is correct
 * after investigating. The player checks the learner's pick against each
 * explanation's `accuracy` tier for scoring. `fullExplanation` is the
 * debrief reveal shown after the learner commits.
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
  investigationCallContentSchema,
]);

export type InvestigationStepContent = z.infer<typeof investigationContentSchema>;
