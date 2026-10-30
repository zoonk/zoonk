import { type ReferenceSyllabusNeed } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { getResearchGoal, toResearchPlanInput } from "@zoonk/core/library/exams/learners";
import { type GoalKind } from "@zoonk/db";

export type ResearchGoal = {
  details: string;
  id: string;
  kind: GoalKind;
  language: string;
  planGoal: string;
  planPersonal: boolean;
  prompt: string;
  referenceSyllabi: ReferenceSyllabusNeed;
  title: string;
  uploadIds: string[];
  userId: string;
};

export async function loadResearchGoalStep(goalId: string): Promise<ResearchGoal | null> {
  "use step";

  const goal = await getResearchGoal(goalId);

  if (!goal) {
    return null;
  }

  const plan = toResearchPlanInput(goal);

  return { ...goal, details: plan.details, planGoal: plan.goal, planPersonal: plan.personal };
}
