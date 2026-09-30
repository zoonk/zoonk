import { type ReferenceSyllabusNeed } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { getResearchGoal } from "@zoonk/core/library/exams/learners";
import { type GoalKind } from "@zoonk/db";

export type ResearchGoal = {
  /** The goal's understood fields as JSON, for the research plan prompt. */
  details: string;
  id: string;
  kind: GoalKind;
  language: string;
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

  return { ...goal, details: JSON.stringify(goal.details) };
}
