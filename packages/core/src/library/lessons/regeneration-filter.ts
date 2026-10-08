/** Bounds what one click can spend: each pulled lesson starts a writing run. */
export const MAX_LESSONS_PER_REGENERATION = 25;

export type LessonRegenerationFilter = { model?: string | null; promptVersion?: string | null };

/**
 * The published lessons whose screens a model or prompt version wrote: the rows admin counts
 * before regenerating and the rows `pullLessonsForRegeneration` takes. Only lessons written from
 * a spec qualify, because the lesson writer rewrites them from it; explanations are answered
 * again when asked. Kept apart from the pull so admin can count without loading the AI tasks.
 */
export function getLessonRegenerationWhere({ model, promptVersion }: LessonRegenerationFilter) {
  return {
    contentStatus: "completed" as const,
    specStatus: "completed" as const,
    steps: {
      some: {
        // The current version's screens (see `CURRENT_STEPS`).
        retiredAt: null,
        ...(model ? { model } : {}),
        ...(promptVersion ? { promptVersion } : {}),
      },
    },
  };
}
