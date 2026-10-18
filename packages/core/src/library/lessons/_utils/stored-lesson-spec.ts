import {
  LESSON_SCREEN_KINDS,
  type LessonSpec,
  SUPPORT_MODES,
} from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { z } from "zod";
import { currentTemplateId } from "../../activities/activity-templates";

/** `Lesson.spec` holds the normalized spec `generateLessonSpec` returns: skill indexes are 0-based. */
const storedLessonSpecSchema: z.ZodType<LessonSpec> = z.object({
  canDo: z.string(),
  description: z.string(),
  estimatedMinutes: z.number(),
  screens: z
    .array(
      z.object({
        // A plan saved before a template merged into an engine names the engine now.
        activityTemplate: z
          .string()
          .nullable()
          .transform((id) => (id === null ? null : currentTemplateId(id))),
        brief: z.string(),
        kind: z.enum(LESSON_SCREEN_KINDS),
        skills: z.array(z.number().int().nonnegative()),
        visual: z.string().nullable(),
      }),
    )
    .min(1),
  skills: z
    .array(
      z.object({
        description: z.string(),
        example: z.string(),
        hard: z.boolean(),
        name: z.string(),
        topic: z.string(),
        useCase: z.string(),
      }),
    )
    .min(1),
  supportMode: z.enum(SUPPORT_MODES),
  title: z.string(),
});

/** The lesson's stored spec, or null when none was written yet or it doesn't match the spec shape. */
export function parseStoredLessonSpec(spec: unknown): LessonSpec | null {
  const parsed = storedLessonSpecSchema.safeParse(spec);
  return parsed.success ? parsed.data : null;
}
