import { z } from "zod";

/** `busy`: a run outside this lesson's hook, such as an explanation saving it, holds the claim. */
export const lessonContentResultSchema = z.object({
  lessonId: z.string(),
  status: z.enum(["busy", "heldBack", "missing", "ready"]),
});

export type LessonContentResult = z.infer<typeof lessonContentResultSchema>;

export function getLessonContentHookToken(lessonId: string): string {
  return `lesson-content:${lessonId}`;
}
