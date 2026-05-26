import { type GenerationStatus } from "@zoonk/db";

export const generatedLessonStatuses = [
  "completed",
  "failed",
] as const satisfies readonly GenerationStatus[];

export type GeneratedLessonStatus = (typeof generatedLessonStatuses)[number];

const defaultGeneratedLessonStatus: GeneratedLessonStatus = "completed";

/**
 * Generated lesson logs intentionally expose only terminal states. Pending and
 * running lessons are still in the pipeline, while completed and failed are the
 * states admins need to review after generation finishes.
 */
export function parseGeneratedLessonStatus(
  status: string | string[] | undefined,
): GeneratedLessonStatus {
  const value = Array.isArray(status) ? status[0] : status;

  if (isGeneratedLessonStatus(value)) {
    return value;
  }

  return defaultGeneratedLessonStatus;
}

/**
 * Query params arrive as arbitrary strings, so the admin lesson list needs a
 * narrow runtime check before passing the status into Prisma.
 */
function isGeneratedLessonStatus(value: string | undefined): value is GeneratedLessonStatus {
  return generatedLessonStatuses.some((status) => status === value);
}
