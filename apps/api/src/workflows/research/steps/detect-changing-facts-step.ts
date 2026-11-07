import {
  type ChangingFactsTopic,
  detectChangingFacts,
} from "@zoonk/ai/tasks/research/changing-facts";
import { toLearnerWords } from "@zoonk/core/library/exams/learners";
import { type ResearchGoal } from "./load-research-goal-step";

export async function detectChangingFactsStep({
  goal,
}: {
  goal: ResearchGoal;
}): Promise<ChangingFactsTopic> {
  "use step";

  if (goal.kind === "exam") {
    return "exam";
  }

  if (goal.kind === "language") {
    return "none";
  }

  return detectChangingFacts({
    analytics: { contentScope: "personal", distinctId: goal.userId, goalId: goal.id },
    goal: toLearnerWords(goal),
  });
}
