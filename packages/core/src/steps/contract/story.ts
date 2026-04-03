import { z } from "zod";

const storyOutcomeSchema = z
  .object({
    minStrongChoices: z.number().int().min(0),
    narrative: z.string(),
    title: z.string(),
  })
  .strict();

/**
 * Intro screen for a story activity (static step, first position).
 * Sets the scene and defines the metrics the player will track.
 */
export const staticStoryIntroContentSchema = z
  .object({
    intro: z.string(),
    metrics: z.array(z.string()).min(1),
    variant: z.literal("storyIntro"),
  })
  .strict();

/**
 * Outcome screen for a story activity (static step, second-to-last position).
 * Shows the narrative result of the player's decisions alongside final metric values.
 */
export const staticStoryOutcomeContentSchema = z
  .object({
    metrics: z.array(z.string()).min(1),
    outcomes: z.array(storyOutcomeSchema).min(1),
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

const storyChoiceSchema = z
  .object({
    alignment: storyAlignmentSchema,
    consequence: z.string(),
    id: z.string(),
    metricEffects: z.array(storyMetricEffectEntrySchema),
    text: z.string(),
  })
  .strict();

/** Schema for a story decision step's content (situation + choices). */
export const storyContentSchema = z
  .object({
    choices: z.array(storyChoiceSchema).min(2),
    situation: z.string(),
  })
  .strict();

export type StoryAlignment = z.infer<typeof storyAlignmentSchema>;
export type StoryStaticVariant =
  | z.infer<typeof staticStoryIntroContentSchema>["variant"]
  | z.infer<typeof staticStoryOutcomeContentSchema>["variant"];
export type StoryStepContent = z.infer<typeof storyContentSchema>;
