import { type ReferenceSyllabusNeed } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { getResearchGoal, toResearchPlanInput } from "@zoonk/core/library/exams/learners";
import { type GoalKind } from "@zoonk/db";

export type ResearchGoal = {
  /** The goal's details the research plan may read, as JSON (see `toResearchPlanInput`). */
  details: string;
  id: string;
  kind: GoalKind;
  language: string;
  /** The goal as the research plan reads it (see `toResearchPlanInput`). */
  planGoal: string;
  /** The plan reads the learner's own words (a goal from their material), so it's personal. */
  planPersonal: boolean;
  prompt: string;
  /** Whether a learn goal is big enough for reference syllabi, or still waiting for its purpose. */
  referenceSyllabi: ReferenceSyllabusNeed;
  title: string;
  /** Material the learner uploaded with the goal, read instead of searching the web. */
  uploadIds: string[];
  userId: string;
};

/** Loads what research reads about a goal, or null when the goal was deleted. */
export async function loadResearchGoalStep(goalId: string): Promise<ResearchGoal | null> {
  "use step";

  const goal = await getResearchGoal(goalId);

  if (!goal) {
    return null;
  }

  const plan = toResearchPlanInput(goal);

  return { ...goal, details: plan.details, planGoal: plan.goal, planPersonal: plan.personal };
}
