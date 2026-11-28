const MAX_SKILL_LESSONS = 60;

/** A whole number of lessons from one to a chapter-sized skill's most. */
export function toSkillLessons(value: number): number {
  return Math.min(MAX_SKILL_LESSONS, Math.max(1, Math.round(value)));
}
