import { type SourceResearchPlan } from "@zoonk/ai/tasks/v2/research/source-plan";
import {
  type ResearchSourceTopic,
  findStoredResearchSources,
} from "@zoonk/core/library/sources/stored";
import { withAiRetry } from "../../_shared/ai-retry";

export async function findStoredSourcesStep({
  plan,
  topic,
}: {
  plan: SourceResearchPlan;
  topic: ResearchSourceTopic;
}): Promise<string[]> {
  "use step";

  return withAiRetry(() =>
    findStoredResearchSources({
      country: plan.country,
      language: plan.language,
      name: plan.name,
      publisher: null,
      searchTerms: plan.searchTerms,
      topic,
    }),
  );
}
