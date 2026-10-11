import { z } from "zod";

const MIN_OBJECTIVES = 2;
const MAX_OBJECTIVES = 4;
const MIN_HINTS = 3;
const MAX_HINTS = 5;

/**
 * What a live call needs, whether it's a unit's role play or an exam's speaking mock: the goal,
 * who the learner talks to, private notes for the voice model, the objectives, the first line and
 * phrases to lean on.
 */
/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the character's facts come before the lines and hints that use them. */
export const scenarioSchema = z.object({
  title: z.string(),
  situation: z.string(),
  character: z.object({ name: z.string(), role: z.string(), place: z.string() }),
  characterBrief: z.string(),
  objectives: z
    .array(z.object({ label: z.string(), description: z.string() }))
    .min(MIN_OBJECTIVES)
    .max(MAX_OBJECTIVES),
  openingLine: z.string(),
  hints: z.array(z.string()).min(MIN_HINTS).max(MAX_HINTS),
});
/* oxlint-enable eslint/sort-keys */
