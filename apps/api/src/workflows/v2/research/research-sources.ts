import { type ResearchPlan } from "@zoonk/ai/tasks/v2/research/plan";
import { type ResearchSourceTopic } from "@zoonk/core/library/sources/stored";
import { scheduleFreshnessChecksStep } from "../freshness/steps/schedule-freshness-checks-step";
import { type ResearchAnalytics } from "./_utils/research-analytics";
import { type ResearchResult } from "./research-result";
import { findSourcesStep } from "./steps/find-sources-step";
import { findStoredSourcesStep } from "./steps/find-stored-sources-step";
import { linkGoalToSourcesStep } from "./steps/link-goal-step";
import { type ResearchGoal } from "./steps/load-research-goal-step";
import { storeSourcesStep } from "./steps/store-sources-step";

export type ResearchContext = {
  analytics: ResearchAnalytics;
  goal: ResearchGoal;
  plan: ResearchPlan;
  uploads: string[];
};

/**
 * Searches official domains first and stores what it finds. Only official
 * documents count for an exam: without one, research asks for an upload.
 */
export async function findAndStoreSources({
  analytics,
  plan,
  requireOfficial,
  topic,
}: {
  analytics: ResearchAnalytics;
  plan: ResearchPlan;
  requireOfficial: boolean;
  topic: "exam" | ResearchSourceTopic;
}): Promise<string[]> {
  const found = await findSourcesStep({ analytics, plan, topic });

  const stored = await storeSourcesStep({
    analytics,
    documents: found.documents,
    language: plan.language,
    topic,
  });

  const hasOfficial = stored.some((source) => source.kind === "official");

  if (requireOfficial && !hasOfficial) {
    return [];
  }

  return stored.map((source) => source.sourceId);
}

/**
 * The Library's still-valid copies first: another learner's research for the same law, product
 * or subject is reused, and only a topic nobody researched yet is searched. A subject no
 * university course or official curriculum teaches leaves the plan without queries: nothing to
 * search.
 */
async function findTopicSources({
  analytics,
  plan,
  topic,
}: {
  analytics: ResearchAnalytics;
  plan: ResearchPlan;
  topic: ResearchSourceTopic;
}): Promise<string[]> {
  const stored = await findStoredSourcesStep({ plan, topic });

  if (stored.length > 0 || plan.queries.length === 0) {
    return stored;
  }

  return findAndStoreSources({ analytics, plan, requireOfficial: false, topic });
}

/** Reference syllabi only add to a curriculum the goal gets anyway, so their absence asks nothing. */
function toNothingFound(topic: ResearchSourceTopic): ResearchResult {
  return topic === "syllabus"
    ? { examBlueprintId: null, sourceIds: [], status: "ready" }
    : { reason: "noOfficialSource", status: "needsUpload" };
}

/**
 * Links a goal to the sources it's built from: a law's current text or a product's docs, which
 * change, or the reference syllabi of a big learn goal, which the coverage check reads. The
 * learner's uploads, when they gave some, are read instead of searching.
 */
export async function researchSources({
  analytics,
  goal,
  plan,
  topic,
  uploads,
}: ResearchContext & { topic: ResearchSourceTopic }): Promise<ResearchResult> {
  const sourceIds =
    uploads.length > 0 ? uploads : await findTopicSources({ analytics, plan, topic });

  if (sourceIds.length === 0) {
    return toNothingFound(topic);
  }

  await linkGoalToSourcesStep({ goalId: goal.id, sourceIds });

  // Uploads never change and syllabi are reused for a year, so only a law's or a product's
  // sources research found keep being checked.
  if (uploads.length === 0 && topic !== "syllabus") {
    await scheduleFreshnessChecksStep(
      sourceIds.map((sourceId) => ({ kind: "source" as const, sourceId })),
    );
  }

  return { examBlueprintId: null, sourceIds, status: "ready" };
}
