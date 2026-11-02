import { z } from "zod";

const MAX_PROVENANCE_LENGTH = 200;

export const lessonRegenerationRequestSchema = z
  .object({
    model: z
      .string()
      .trim()
      .min(1)
      .max(MAX_PROVENANCE_LENGTH)
      .optional()
      .meta({ description: "Rewrite lessons whose screens this model wrote" }),
    promptVersion: z
      .string()
      .trim()
      .min(1)
      .max(MAX_PROVENANCE_LENGTH)
      .optional()
      .meta({ description: "Rewrite lessons whose screens this prompt version wrote" }),
  })
  .strict()
  .refine((body) => Boolean(body.model ?? body.promptVersion), {
    message: "Send a model, a prompt version or both",
  })
  .meta({ id: "LessonRegenerationRequest" });

export const lessonRegenerationResponseSchema = z
  .object({
    lessonIds: z
      .array(z.uuid())
      .meta({ description: "Lessons taken out of play, each with a writing run started" }),
  })
  .meta({ id: "LessonRegeneration" });
