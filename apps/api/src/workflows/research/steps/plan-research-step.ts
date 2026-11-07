import { type ExamResearchPlan, generateExamResearchPlan } from "@zoonk/ai/tasks/research/plan";
import {
  type SourceResearchPlan,
  type SourceResearchTopic,
  generateSourceResearchPlan,
} from "@zoonk/ai/tasks/research/source-plan";
import { toLearnerWords } from "@zoonk/core/library/exams/learners";
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

  // A product plan returns only search hints, which are never saved, and the release a learner names
  // can be missing from the goal's short title, so it reads what they typed.
  const ownWords = topic === "product";

  const { data } = await generateSourceResearchPlan({
    analytics: toPlanAnalytics({ analytics, personal: goal.planPersonal || ownWords }),
    details: goal.details,
    goal: ownWords ? toLearnerWords(goal) : goal.planGoal,
    topic,
  });

  return data;
}
