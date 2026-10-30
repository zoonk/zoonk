import { type ExamResearchPlan, generateExamResearchPlan } from "@zoonk/ai/tasks/v2/research/plan";
import { type ExamIdentity } from "@zoonk/core/library/exams/identity";
import { type ResearchAnalytics } from "../../research/_utils/research-analytics";

export async function planNextNoticeStep({
  analytics,
  identity,
}: {
  analytics: ResearchAnalytics;
  identity: ExamIdentity;
}): Promise<ExamResearchPlan> {
  "use step";

  const { data } = await generateExamResearchPlan({
    analytics,
    details: JSON.stringify({ board: identity.board, country: identity.country, edition: "next" }),
    goal: identity.role ? `${identity.name}, ${identity.role}` : identity.name,
  });

  return data;
}
