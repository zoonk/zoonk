import { type StoryOutcomeTier } from "@zoonk/utils/activities";
import { z } from "zod";
import { stepImageSchema } from "./image";

const storyOutcomeSchema = z
  .object({
    image: stepImageSchema.optional(),
    narrative: z.string(),
    title: z.string(),
  })
  .strict();

const storyOutcomeSchemaShape = {
  bad: storyOutcomeSchema,
  good: storyOutcomeSchema,
  ok: storyOutcomeSchema,
  perfect: storyOutcomeSchema,
  terrible: storyOutcomeSchema,
} satisfies Record<StoryOutcomeTier, typeof storyOutcomeSchema>;

const storyMetricSchema = z
  .object({
    label: z.string(),
  })
  .strict();

const storyMetricsSchema = z.array(storyMetricSchema).min(2);

/**
 * Outcome screen for a story activity (static step, final position).
 * Shows the narrative result of the player's decisions alongside final metric values.
 */
export const staticStoryOutcomeContentSchema = z
  .object({
    metrics: storyMetricsSchema,
    outcomes: z.object(storyOutcomeSchemaShape),
    variant: z.literal("storyOutcome"),
  })
  .strict();

const storyAlignmentSchema = z.enum(["strong", "partial", "weak"]);

const storyMetricEffectSchema = z.enum(["positive", "neutral", "negative"]);

const storyMetricEffectEntrySchema = z
  .object({
    effect: storyMetricEffectSchema,
    metric: z.string(),
  })
  .strict();

const storyOptionSchema = z
  .object({
    alignment: storyAlignmentSchema,
    feedback: z.string(),
    id: z.string(),
    metricEffects: z.array(storyMetricEffectEntrySchema),
    stateImage: stepImageSchema,
    text: z.string(),
  })
  .strict();

/** Schema for a story decision step's content (problem + selectable options). */
export const storyContentSchema = z
  .object({
    image: stepImageSchema.optional(),
    options: z.array(storyOptionSchema).min(2),
    problem: z.string(),
  })
  .strict();

export type StoryAlignment = z.infer<typeof storyAlignmentSchema>;
export type StoryStepContent = z.infer<typeof storyContentSchema>;
