import { type ResearchPlan, generateResearchPlan } from "@zoonk/ai/tasks/v2/research/plan";
import { type ExamIdentity } from "@zoonk/core/library/exams/identity";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../../research/_utils/research-analytics";

/**
 * Where to look for an exam's next notice: the queries and official domains research would use for
 * a learner preparing for it, from the stored exam's identity (no learner's words).
 */
export async function planNextNoticeStep({
  analytics,
  identity,
}: {
  analytics: ResearchAnalytics;
  identity: ExamIdentity;
}): Promise<ResearchPlan> {
  "use step";

  const { data } = await withAiRetry(() =>
    generateResearchPlan({
      analytics,
      details: JSON.stringify({
        board: identity.board,
        country: identity.country,
        edition: "next",
      }),
      goal: identity.role ? `${identity.name}, ${identity.role}` : identity.name,
      topic: "exam",
    }),
  );

  return data;
}
