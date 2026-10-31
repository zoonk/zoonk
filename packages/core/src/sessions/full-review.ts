export function isFullReviewDay(day: { fullReviewSkillIds?: readonly string[] | null }): boolean {
  return Boolean(day.fullReviewSkillIds?.length);
}

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

/** Full reviews must cover every skill even on short days; returns zero when complete coverage is impossible. */
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
