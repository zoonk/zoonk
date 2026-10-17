/** A day whose practice asks every one of the goal's skills (see `fullReviewSkillIds`). */
export function isFullReviewDay(day: { fullReviewSkillIds?: readonly string[] | null }): boolean {
  return Boolean(day.fullReviewSkillIds?.length);
}

/** A full review asks every one of the goal's skills; one that misses some is only practice. */
export function isFullReview({
  fullReviewSkillIds,
  skillIds,
}: {
  fullReviewSkillIds: readonly string[] | null | undefined;
  skillIds: readonly string[];
}): boolean {
  return (
    Boolean(fullReviewSkillIds?.length) &&
    (fullReviewSkillIds ?? []).every((skillId) => skillIds.includes(skillId))
  );
}

/**
 * How many questions a full review's practice block takes to ask every skill the day's quick
 * review doesn't: the day's mistake drills (`drilled`), then practice's questions in the order it
 * asks them. Asking every topic is the day's point, so a short day doesn't cut it (Pedro's light
 * day asked 5 questions on 3 of his 11 topics). Zero when no skill is left or practice can't ask
 * them all.
 */
export function countFullReviewQuestions({
  drilled,
  fullReviewSkillIds,
  practice,
  reviewedSkillIds,
}: {
  drilled: number;
  fullReviewSkillIds: readonly string[] | null | undefined;
  practice: readonly { skillId: string }[];
  reviewedSkillIds: readonly string[];
}): number {
  const left = (fullReviewSkillIds ?? []).filter((skillId) => !reviewedSkillIds.includes(skillId));

  const asksAll = (count: number) =>
    left.every((skillId) => practice.slice(0, count).some((item) => item.skillId === skillId));

  const asked = left.length > 0 ? practice.findIndex((_, index) => asksAll(index + 1)) + 1 : 0;
  return asked > 0 ? drilled + asked : 0;
}
