import { type FoundSourceDocument } from "@zoonk/ai/tasks/v2/research/find-official-sources";
import { type ExamResearchPlan } from "@zoonk/ai/tasks/v2/research/plan";
import { type SourceResearchPlan } from "@zoonk/ai/tasks/v2/research/source-plan";
import { type ResearchSourceTopic } from "@zoonk/core/library/sources/stored";
import { scheduleFreshnessChecksStep } from "../freshness/steps/schedule-freshness-checks-step";
import { type ResearchAnalytics, toPlanAnalytics } from "./_utils/research-analytics";
import { type ResearchResult } from "./research-result";
import { findSourcesStep } from "./steps/find-sources-step";
import { findStoredSourcesStep } from "./steps/find-stored-sources-step";
import { linkGoalToSourcesStep } from "./steps/link-goal-step";
import { type ResearchGoal } from "./steps/load-research-goal-step";
import {
  type StoredSource,
  keepReadableSourcesStep,
  storeSourceStep,
} from "./steps/store-sources-step";

export type ResearchContext<TPlan extends ExamResearchPlan | SourceResearchPlan> = {
  analytics: ResearchAnalytics;
  goal: ResearchGoal;
  plan: TPlan;
  uploads: string[];
};

type SourceTopic = "exam" | ResearchSourceTopic;

/**
 * Stores each document in a step of its own that's retried alone (`storeSourceStep`) and keeps
 * the readable ones; `unreadable` are those that still failed or stored no text.
 */
async function storeDocuments({
  analytics,
  documents,
  language,
  topic,
}: {
  analytics: ResearchAnalytics;
  documents: FoundSourceDocument[];
  language: string;
  topic: SourceTopic;
}): Promise<{ stored: StoredSource[]; unreadable: FoundSourceDocument[] }> {
  const results = await Promise.allSettled(
    documents.map((document) => storeSourceStep({ analytics, document, language, topic })),
  );

  const stored = await keepReadableSourcesStep(
    results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
  );

  const readable = new Set(stored.map((source) => source.sourceId));

  const unreadable = documents.filter((_document, index) => {
    const result = results[index];
    return result?.status !== "fulfilled" || !readable.has(result.value.sourceId);
  });

  return { stored, unreadable };
}

/**
 * Copies, on other sites, of an exam's documents that couldn't be read, when the notice is one of
 * them: Vunesp's sites answer every download with 403, so TJ-SP's research read only the court's
 * news page and stored the essay as the whole exam. A search for copies that fails leaves research
 * with what it read.
 */
async function storeCopies({
  analytics,
  plan,
  searchAnalytics,
  stored,
  topic,
  unreadable,
}: {
  analytics: ResearchAnalytics;
  plan: ExamResearchPlan | SourceResearchPlan;
  searchAnalytics: ResearchAnalytics;
  stored: StoredSource[];
  topic: SourceTopic;
  unreadable: FoundSourceDocument[];
}): Promise<StoredSource[]> {
  const isNoticeUnread =
    topic === "exam" &&
    unreadable.some((document) => document.documentType === "notice") &&
    !stored.some((source) => source.documentType === "notice");

  if (!isNoticeUnread) {
    return [];
  }

  const [search] = await Promise.allSettled([
    findSourcesStep({
      analytics: searchAnalytics,
      plan,
      topic,
      unreadable: unreadable.map((document) => document.url),
    }),
  ]);

  if (search.status === "rejected" || search.value.documents.length === 0) {
    return [];
  }

  const copies = await storeDocuments({
    analytics,
    documents: search.value.documents,
    language: plan.language,
    topic,
  });

  return copies.stored;
}

/**
 * Searches official domains first and stores what it finds, each document in a step of its own
 * that's retried alone; one that still fails is left out, and when that leaves an exam without
 * its notice, copies of what couldn't be read are searched on other sites and read after it
 * (`storeCopies`). Only official documents count for an exam: without one, research asks for an
 * upload.
 */
export async function findAndStoreSources({
  analytics,
  personalPlan = false,
  plan,
  requireOfficial,
  topic,
}: {
  analytics: ResearchAnalytics;
  /** The plan was made from the learner's own words, so the search that reads it is theirs. */
  personalPlan?: boolean;
  plan: ExamResearchPlan | SourceResearchPlan;
  requireOfficial: boolean;
  topic: SourceTopic;
}): Promise<string[]> {
  const searchAnalytics = toPlanAnalytics({ analytics, personal: personalPlan });
  const found = await findSourcesStep({ analytics: searchAnalytics, plan, topic });

  const { stored, unreadable } = await storeDocuments({
    analytics,
    documents: found.documents,
    language: plan.language,
    topic,
  });

  const hasOfficial = stored.some((source) => source.kind === "official");

  if (requireOfficial && !hasOfficial) {
    return [];
  }

  const copies = await storeCopies({ analytics, plan, searchAnalytics, stored, topic, unreadable });

  const sourceIds = [...stored, ...copies].map((source) => source.sourceId);

  // A copy can be the Library's same document as one already read.
  return [...new Set(sourceIds)];
}

/**
 * The Library's still-valid copies first: another learner's research for the same law, product
 * or subject is reused, and only a topic nobody researched yet is searched. A subject no
 * university course or official curriculum teaches leaves the plan without queries: nothing to
 * search.
 */
async function findTopicSources({
  analytics,
  personalPlan,
  plan,
  topic,
}: {
  analytics: ResearchAnalytics;
  personalPlan: boolean;
  plan: SourceResearchPlan;
  topic: ResearchSourceTopic;
}): Promise<string[]> {
  const stored = await findStoredSourcesStep({ plan, topic });

  if (stored.length > 0 || plan.queries.length === 0) {
    return stored;
  }

  return findAndStoreSources({ analytics, personalPlan, plan, requireOfficial: false, topic });
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
}: ResearchContext<SourceResearchPlan> & { topic: ResearchSourceTopic }): Promise<ResearchResult> {
  const sourceIds =
    uploads.length > 0
      ? uploads
      : await findTopicSources({ analytics, personalPlan: goal.planPersonal, plan, topic });

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
