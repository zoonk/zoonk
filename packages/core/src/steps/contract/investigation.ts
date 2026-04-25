import { INVESTIGATION_EXPERIMENT_COUNT } from "@zoonk/utils/activities";
import { z } from "zod";

const investigationActionQualitySchema = z.enum(["critical", "useful", "weak"]);

const investigationAccuracySchema = z.enum(["best", "partial", "wrong"]);

const investigationCallOptionSchema = z
  .object({
    accuracy: investigationAccuracySchema,
    feedback: z.string(),
    id: z.string(),
    text: z.string(),
  })
  .strict();

/**
 * Each action carries its own feedback data so that evidence
 * travels with the action through server-side shuffle.
 * When the learner checks an action, the feedback is shown as evidence.
 */
const investigationActionOptionSchema = z
  .object({
    feedback: z.string(),
    id: z.string(),
    quality: investigationActionQualitySchema,
    text: z.string(),
  })
  .strict();

/**
 * Problem step: presents the scenario.
 * Read-only — the learner reads the case and taps "Investigate" to start.
 */
const investigationProblemContentSchema = z
  .object({
    scenario: z.string(),
    variant: z.literal("problem"),
  })
  .strict();

/**
 * Action step: the full list of actions the learner can choose from.
 * The player filters out already-picked actions using the investigation loop.
 * Each action carries its feedback data for the feedback screen.
 * `quality` indicates how informative the action is for scoring.
 */
const investigationActionContentSchema = z
  .object({
    options: z.array(investigationActionOptionSchema).min(INVESTIGATION_EXPERIMENT_COUNT),
    variant: z.literal("action"),
  })
  .strict();

/**
 * Call step: the learner picks which explanation they believe is correct
 * after investigating. The player checks the learner's pick against each
 * explanation's `accuracy` tier for scoring. Each explanation carries its
 * own `feedback` message shown after the learner commits — explaining
 * why their specific choice is correct, partially right, or wrong.
 */
const investigationCallContentSchema = z
  .object({
    options: z.array(investigationCallOptionSchema),
    variant: z.literal("call"),
  })
  .strict();

export const investigationContentSchema = z.discriminatedUnion("variant", [
  investigationProblemContentSchema,
  investigationActionContentSchema,
  investigationCallContentSchema,
]);

export type InvestigationActionQuality = z.infer<typeof investigationActionQualitySchema>;
export type InvestigationCallAccuracy = z.infer<typeof investigationAccuracySchema>;
export type InvestigationStepContent = z.infer<typeof investigationContentSchema>;
