/** Estimates aren't exact, so a graph may run this far past its budget before it's scaled down. */
const BUDGET_TOLERANCE = 1.25;

type BudgetedSkill = { estimatedLessons: number; topics?: readonly string[] };

function getLeastLessons(skill: BudgetedSkill): number {
  return Math.max(1, skill.topics?.length ?? 0);
}

/**
 * Keeps proportions, and never goes below a lesson for each topic of the material a skill teaches.
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
