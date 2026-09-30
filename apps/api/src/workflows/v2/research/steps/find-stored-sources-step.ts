import { type ResearchPlan } from "@zoonk/ai/tasks/v2/research/plan";
import {
  type ResearchSourceTopic,
  findStoredResearchSources,
} from "@zoonk/core/library/sources/stored";
import { withAiRetry } from "../../_shared/ai-retry";

/**
 * The official sources another learner's research already stored for the same law, product or
 * subject and still valid, so this goal reuses them instead of searching the web again. Empty
 * when none fits.
 */
export async function findStoredSourcesStep({
  plan,
  topic,
}: {
  plan: ResearchPlan;
  topic: ResearchSourceTopic;
}): Promise<string[]> {
  "use step";

  return withAiRetry(() =>
    findStoredResearchSources({
      country: plan.country,
      language: plan.language,
      name: plan.name,
      publisher: plan.board,
      searchTerms: plan.searchTerms,
      topic,
    }),
  );
}
