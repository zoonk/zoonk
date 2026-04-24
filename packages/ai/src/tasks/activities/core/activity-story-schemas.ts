import { type StoryOutcomeTier } from "@zoonk/utils/activities";
import { z } from "zod";

const storyAlignmentSchema = z.enum(["strong", "partial", "weak"]);
const storyMetricEffectSchema = z.enum(["positive", "neutral", "negative"]);

const storyOutcomeSchema = z.object({
  imagePrompt: z.string().min(1),
  narrative: z.string(),
  title: z.string(),
});

const storyOutcomeSchemaShape = {
  bad: storyOutcomeSchema,
  good: storyOutcomeSchema,
  ok: storyOutcomeSchema,
  perfect: storyOutcomeSchema,
  terrible: storyOutcomeSchema,
} satisfies Record<StoryOutcomeTier, typeof storyOutcomeSchema>;

const storyChoiceSchema = z.object({
  alignment: storyAlignmentSchema,
  consequence: z.string(),
  label: z.string(),
  metricEffects: z.array(z.object({ effect: storyMetricEffectSchema, metric: z.string() })).min(1),
  stateImagePrompt: z.string().min(1),
});

const storyStepPlanSchema = z.object({
  imagePrompt: z.string().min(1),
  problem: z.string(),
});

const storyStepSchema = storyStepPlanSchema.extend({
  choices: z.array(storyChoiceSchema).min(2),
});

export const activityStoryPlanSchema = z.object({
  intro: z.string(),
  introImagePrompt: z.string().min(1),
  metrics: z.array(z.string()).min(2),
  outcomes: z.object(storyOutcomeSchemaShape),
  steps: z.array(storyStepPlanSchema).min(1),
  title: z.string().min(1),
});

const activityStorySchema = activityStoryPlanSchema.extend({
  steps: z.array(storyStepSchema).min(1),
});

export type ActivityStoryChoicesSchema = {
  steps: { choices: z.infer<typeof storyChoiceSchema>[] }[];
};
export type ActivityStoryPlanSchema = z.infer<typeof activityStoryPlanSchema>;
export type ActivityStorySchema = z.infer<typeof activityStorySchema>;

/**
 * Builds the choice schema from the already-generated story plan. At this
 * point metric names and step count are known, so invalid metric references or
 * missing/extra step choice groups should fail at the AI output boundary.
 */
export function createActivityStoryChoicesSchema(storyPlan: ActivityStoryPlanSchema) {
  const metricSchema = z.enum(storyPlan.metrics);

  const storyMetricEffectEntrySchema = z.object({
    effect: storyMetricEffectSchema,
    metric: metricSchema,
  });

  const storyPlanChoiceSchema = storyChoiceSchema.extend({
    metricEffects: z.array(storyMetricEffectEntrySchema).min(1),
  });

  return z.object({
    steps: z
      .array(z.object({ choices: z.array(storyPlanChoiceSchema).min(2) }))
      .length(storyPlan.steps.length),
  });
}

/**
 * Reads the generated choices for one planned step. The choice task must keep
 * the same step order as the story plan because image generation and saving
 * rely on positional alignment.
 */
function getChoicesForStep({
  choices,
  stepIndex,
}: {
  choices: ActivityStoryChoicesSchema;
  stepIndex: number;
}) {
  const stepChoices = choices.steps[stepIndex]?.choices;

  if (!stepChoices) {
    throw new Error(`Story choices are missing for step ${stepIndex + 1}`);
  }

  return stepChoices;
}

/**
 * Combines the story skeleton with the focused choice-generation result.
 * Keeping this merge deterministic lets the workflow generate choices in a
 * separate AI task without changing the downstream image and save contracts.
 */
export function buildActivityStoryWithChoices({
  choices,
  storyPlan,
}: {
  choices: ActivityStoryChoicesSchema;
  storyPlan: ActivityStoryPlanSchema;
}): ActivityStorySchema {
  return {
    ...storyPlan,
    steps: storyPlan.steps.map((step, stepIndex) => ({
      ...step,
      choices: getChoicesForStep({ choices, stepIndex }),
    })),
  };
}
