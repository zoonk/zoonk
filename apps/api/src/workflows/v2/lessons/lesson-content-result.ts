import { z } from "zod";

/**
 * How a lesson content run ends. `ready`: the lesson can be played. `heldBack`: its checks held
 * back every draft this run wrote; it waits for another run while it has drafts left, and is set
 * aside after its last. `missing`: the lesson was deleted or can't be planned.
 * `busy`: a run outside this lesson's hook (an explanation saving it) still holds the claim.
 */
export const lessonContentResultSchema = z.object({
  lessonId: z.string(),
  status: z.enum(["busy", "heldBack", "missing", "ready"]),
});

export type LessonContentResult = z.infer<typeof lessonContentResultSchema>;

/** One run per lesson at a time: a second request for the same lesson joins the first. */
export function getLessonContentHookToken(lessonId: string): string {
  return `lesson-content:${lessonId}`;
}
