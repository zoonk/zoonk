import { type PlanGraphSkill } from "./plan-state";

const MIN_STAND_IN_LESSONS = 4;

/** The most lessons one chapter written ahead for a topic holds. */
export const CHAPTER_LESSONS = 10;

export function countStandInLessons({
  domain,
  includeShortRemainder = false,
  lessons,
  outlined = false,
  taught,
}: {
  domain?: PlanGraphSkill["domain"];
  includeShortRemainder?: boolean;
  lessons: number;
  outlined?: boolean;
  taught: number;
}): number {
  if (outlined) {
    return 0;
  }

  if (taught === 0) {
    return lessons;
  }

  const missing = lessons - taught;
  return missing >= (domain || includeShortRemainder ? 1 : MIN_STAND_IN_LESSONS) ? missing : 0;
}
