/** A graph may run this far past its budget before it's scaled down: estimates aren't exact. */
const BUDGET_TOLERANCE = 1.25;

type BudgetedSkill = { estimatedLessons: number; topics?: readonly string[] };

/** A lesson for each topic of the material the skill teaches, and at least one. */
function getLeastLessons(skill: BudgetedSkill): number {
  return Math.max(1, skill.topics?.length ?? 0);
}

/**
 * Skills' lessons for a test from the learner's material days away (`LESSON_BUDGET`, the most its
 * days hold): scaled down to the budget when the graph runs past it, keeping their proportions,
 * and never below a lesson for each topic of the material a skill teaches, so a skill that took
 * several headings still teaches every one of them.
 */
export function fitLessonBudget<T extends BudgetedSkill>({
  budget,
  skills,
}: {
  budget: number | null | undefined;
  skills: readonly T[];
}): T[] {
  if (!budget || budget <= 0) {
    return [...skills];
  }

  const total = skills.reduce((sum, skill) => sum + skill.estimatedLessons, 0);
  const scale = total > budget * BUDGET_TOLERANCE ? budget / total : 1;

  return skills.map((skill) => {
    const lessons = Math.max(getLeastLessons(skill), Math.round(skill.estimatedLessons * scale));

    return lessons === skill.estimatedLessons ? skill : { ...skill, estimatedLessons: lessons };
  });
}
