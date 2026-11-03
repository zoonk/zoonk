import {
  LESSON_SCREEN_KINDS,
  type LessonScreen,
  type LessonSpec,
} from "@zoonk/ai/tasks/lesson-spec/rules";
import { LESSON_VISUAL_KINDS } from "@zoonk/ai/tasks/lesson-spec/visuals";
import { z } from "zod";

/** Plans saved before screens named their visual's kind show a picture or a template, or nothing. */
function savedVisualKind(screen: Omit<LessonScreen, "visualKind">): LessonScreen["visualKind"] {
  if (screen.kind === "activity") {
    return "template";
  }

  if (screen.visual) {
    return "picture";
  }

  return screen.activityTemplate ? "template" : "none";
}

/** `Lesson.spec` holds the normalized spec `generateLessonSpec` returns: skill indexes are 0-based. */
const storedLessonSpecSchema: z.ZodType<LessonSpec> = z.object({
  canDo: z.string(),
  description: z.string(),
  estimatedMinutes: z.number(),
  screens: z
    .array(
      z
        .object({
          activityTemplate: z.string().nullable(),
          brief: z.string(),
          kind: z.enum(LESSON_SCREEN_KINDS),
          skills: z.array(z.number().int().nonnegative()),
          visual: z.string().nullable(),
          visualKind: z.enum(LESSON_VISUAL_KINDS).optional(),
        })
        .transform(({ visualKind, ...screen }) => ({
          ...screen,
          visualKind: visualKind ?? savedVisualKind(screen),
        })),
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
  title: z.string(),
});

export function parseStoredLessonSpec(spec: unknown): LessonSpec | null {
  const parsed = storedLessonSpecSchema.safeParse(spec);
  return parsed.success ? parsed.data : null;
}
