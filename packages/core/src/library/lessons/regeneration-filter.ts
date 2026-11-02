export const MAX_LESSONS_PER_REGENERATION = 25;

export type LessonRegenerationFilter = { model?: string | null; promptVersion?: string | null };

export function getLessonRegenerationWhere({ model, promptVersion }: LessonRegenerationFilter) {
  return {
    contentStatus: "completed" as const,
    specStatus: "completed" as const,
    steps: {
      some: {
        retiredAt: null,
        ...(model ? { model } : {}),
        ...(promptVersion ? { promptVersion } : {}),
      },
    },
  };
}
