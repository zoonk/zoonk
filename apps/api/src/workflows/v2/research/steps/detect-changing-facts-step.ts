import {
  type ChangingFactsTopic,
  detectChangingFacts,
} from "@zoonk/ai/tasks/v2/research/changing-facts";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchGoal } from "./load-research-goal-step";

/**
 * Exam goals are already known to depend on an exam's notice, and language
 * goals never do (choosing an exam in a language moves to the exam goal), so
 * only the other goals ask the classifier.
 */
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

  return withAiRetry(() =>
    detectChangingFacts({
      analytics: { contentScope: "personal", distinctId: goal.userId, goalId: goal.id },
      goal: `${goal.title}\n${goal.prompt}`,
    }),
  );
}
