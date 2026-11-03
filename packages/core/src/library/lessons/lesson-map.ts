import { LESSON_MAP_SHAPES, type LessonMap } from "@zoonk/ai/tasks/lesson-writer/schema";
import { z } from "zod";
import { explanationSchema } from "../steps/contract/content-schemas";
import { normalizeStepContentValue } from "../steps/contract/normalize-step-content";

export type { LessonMap } from "@zoonk/ai/tasks/lesson-writer/schema";

const ideaSchema = z
  .object({
    label: z
      .string()
      .min(1)
      .optional()
      .meta({
        description: "The idea's name in 1 to 4 words; maps written before labels have none",
      }),
    text: explanationSchema.meta({ description: "The idea in one complete sentence" }),
  })
  .strict();

/** The lesson map as clients receive it, always with a shape. */
export const lessonMapSchema = z
  .object({
    ideas: z.array(ideaSchema).min(1),
    shape: z
      .enum(LESSON_MAP_SHAPES)
      .meta({
        description:
          "`nested`: each idea is a level inside the next, smallest first. `hub`: ideas under the lesson's title",
      }),
  })
  .strict() satisfies z.ZodType<LessonMap>;

/** Saved maps may leave out the shape, which means `hub`. */
const savedLessonMapSchema = lessonMapSchema.extend({
  shape: lessonMapSchema.shape.shape.optional(),
});

/** Null when the lesson has no map (not written yet, or a kind of lesson without one). */
export function readLessonMap(summary: unknown): LessonMap | null {
  const parsed = savedLessonMapSchema.safeParse(normalizeStepContentValue(summary));
  return parsed.success ? { ideas: parsed.data.ideas, shape: parsed.data.shape ?? "hub" } : null;
}

export function readLessonMapSentences(summary: unknown): string[] {
  return readLessonMap(summary)?.ideas.map((idea) => idea.text) ?? [];
}
