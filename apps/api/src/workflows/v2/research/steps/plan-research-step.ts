import { type ExamResearchPlan, generateExamResearchPlan } from "@zoonk/ai/tasks/v2/research/plan";
import {
  type SourceResearchPlan,
  type SourceResearchTopic,
  generateSourceResearchPlan,
} from "@zoonk/ai/tasks/v2/research/source-plan";
import { type ResearchAnalytics, toPlanAnalytics } from "../_utils/research-analytics";
import { type ResearchGoal } from "./load-research-goal-step";

export async function planExamResearchStep({
  analytics,
  goal,
}: {
  analytics: ResearchAnalytics;
  goal: ResearchGoal;
}): Promise<ExamResearchPlan> {
  "use step";

  const { data } = await generateExamResearchPlan({
    analytics: toPlanAnalytics({ analytics, personal: goal.planPersonal }),
    details: goal.details,
    goal: goal.planGoal,
  });

  return data;
}

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

  const { data } = await generateSourceResearchPlan({
    analytics: toPlanAnalytics({ analytics, personal: goal.planPersonal }),
    details: goal.details,
    goal: goal.planGoal,
    topic,
  });

  return data;
}
