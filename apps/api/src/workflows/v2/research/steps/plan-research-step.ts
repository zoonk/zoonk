import {
  type ResearchPlan,
  type ResearchTopic,
  generateResearchPlan,
} from "@zoonk/ai/tasks/v2/research/plan";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";
import { type ResearchGoal } from "./load-research-goal-step";

/** Names the canonical exam (or law, product or subject) and where its organizer publishes. */
export async function planResearchStep({
  analytics,
  goal,
  topic,
}: {
  analytics: ResearchAnalytics;
  goal: ResearchGoal;
  topic: ResearchTopic;
}): Promise<ResearchPlan> {
  "use step";

  const { data } = await withAiRetry(() =>
    generateResearchPlan({
      analytics,
      details: goal.details,
      goal: `${goal.title}\n${goal.prompt}`,
      topic,
    }),
  );

  return data;
}
