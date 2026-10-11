import { type ExamResearchPlan, generateExamResearchPlan } from "@zoonk/ai/tasks/v2/research/plan";
import {
  type SourceResearchPlan,
  type SourceResearchTopic,
  generateSourceResearchPlan,
} from "@zoonk/ai/tasks/v2/research/source-plan";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics, toPlanAnalytics } from "../_utils/research-analytics";
import { type ResearchGoal } from "./load-research-goal-step";

/** Names the canonical exam (its name and role) and where its organizer publishes. */
export async function planExamResearchStep({
  analytics,
  goal,
}: {
  analytics: ResearchAnalytics;
  goal: ResearchGoal;
}): Promise<ExamResearchPlan> {
  "use step";

  const { data } = await withAiRetry(() =>
    generateExamResearchPlan({
      analytics: toPlanAnalytics({ analytics, personal: goal.planPersonal }),
      details: goal.details,
      goal: goal.planGoal,
    }),
  );

  return data;
}

/** Names the canonical law, product or subject and where it's published. */
export async function planSourceResearchStep({
  analytics,
  goal,
  topic,
}: {
  analytics: ResearchAnalytics;
  goal: ResearchGoal;
  topic: SourceResearchTopic;
}): Promise<SourceResearchPlan> {
  "use step";

  const { data } = await withAiRetry(() =>
    generateSourceResearchPlan({
      analytics: toPlanAnalytics({ analytics, personal: goal.planPersonal }),
      details: goal.details,
      goal: goal.planGoal,
      topic,
    }),
  );

  return data;
}
