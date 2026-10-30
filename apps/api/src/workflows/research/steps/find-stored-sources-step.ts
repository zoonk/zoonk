import { type SourceResearchPlan } from "@zoonk/ai/tasks/research/source-plan";
import {
  type ResearchSourceTopic,
  findStoredResearchSources,
} from "@zoonk/core/library/sources/stored";

export async function findStoredSourcesStep({
  plan,
  topic,
}: {
  plan: SourceResearchPlan;
  topic: ResearchSourceTopic;
}): Promise<string[]> {
  "use step";

  return findStoredResearchSources({
    country: plan.country,
    language: plan.language,
    name: plan.name,
    publisher: null,
    searchTerms: plan.searchTerms,
    topic,
  });
}
