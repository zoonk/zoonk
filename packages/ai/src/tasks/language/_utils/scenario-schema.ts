import { z } from "zod";

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the character's facts come before the lines and hints that use them. */
export const scenarioSchema = z.object({
  title: z.string(),
  situation: z.string(),
  character: z.object({ name: z.string(), role: z.string(), place: z.string() }),
  characterBrief: z.string(),
  objectives: z.array(z.object({ label: z.string(), description: z.string() })).min(1),
  openingLine: z.string(),
  hints: z.array(z.string()),
});
/* oxlint-enable eslint/sort-keys */
