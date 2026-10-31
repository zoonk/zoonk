import { type FoundSourceDocument } from "@zoonk/ai/tasks/research/find-official-sources";
import { type ExamResearchPlan } from "@zoonk/ai/tasks/research/plan";
import { type SourceResearchPlan } from "@zoonk/ai/tasks/research/source-plan";
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

type Typed = Pick<StoredSource, "documentType">;

/** The notice's tables and content list, without which a reading misses counts, weights or topics. */
const REQUIRED_ANNEXES: ReadonlySet<StoredSource["documentType"]> = new Set(["annex", "syllabus"]);

function isNotice(source: Typed): boolean {
  return source.documentType === "notice";
}

/** The notice, unless another notice was read, and its required annexes, none of which downloaded. */
function listLostParts({
  stored,
  topic,
  unreadable,
}: {
  stored: StoredSource[];
  topic: SourceTopic;
  unreadable: FoundSourceDocument[];
}): FoundSourceDocument[] {
  if (topic !== "exam") {
    return [];
  }

  const hasNotice = stored.some((source) => isNotice(source));

  return unreadable.filter((document) =>
    isNotice(document) ? !hasNotice : REQUIRED_ANNEXES.has(document.documentType),
  );
}

function countType({ documentType }: Typed, documents: readonly Typed[]): number {
  return documents.filter((document) => document.documentType === documentType).length;
}

function isRecovered({ copies, lost }: { copies: Typed[]; lost: Typed[] }): boolean {
  return lost.every((document) => countType(document, copies) >= countType(document, lost));
}

/** Some boards' sites refuse every download (Vunesp's answer 403), so copies are read from other sites. */
async function storeCopies({
  analytics,
  lost,
  plan,
  searchAnalytics,
  topic,
}: {
  analytics: ResearchAnalytics;
  lost: FoundSourceDocument[];
  plan: ExamResearchPlan | SourceResearchPlan;
  searchAnalytics: ResearchAnalytics;
  topic: SourceTopic;
}): Promise<StoredSource[]> {
  if (lost.length === 0) {
    return [];
  }

  const [search] = await Promise.allSettled([
    findSourcesStep({
      analytics: searchAnalytics,
      plan,
      topic,
      unreadable: lost.map((document) => document.url),
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
 * `board` runs the edition the found documents are for; null outside exams or when they don't say.
 * `complete` is false when the notice's required annexes couldn't be read or copied.
 */
export async function findAndStoreSources({
  analytics,
  personalPlan = false,
  plan,
  requireOfficial,
  topic,
}: {
  analytics: ResearchAnalytics;
  personalPlan?: boolean;
  plan: ExamResearchPlan | SourceResearchPlan;
  requireOfficial: boolean;
  topic: SourceTopic;
}): Promise<{ board: string | null; complete: boolean; sourceIds: string[] }> {
  const searchAnalytics = toPlanAnalytics({ analytics, personal: personalPlan });
  const found = await findSourcesStep({ analytics: searchAnalytics, plan, topic });

  const { stored, unreadable } = await storeDocuments({
    analytics,
    documents: found.documents,
    language: plan.language,
    topic,
  });

  const hasOfficial = found.documents.some((document) => document.kind === "official");

  if (requireOfficial && !hasOfficial) {
    return { board: null, complete: true, sourceIds: [] };
  }

  const lost = listLostParts({ stored, topic, unreadable });
  const copies = await storeCopies({ analytics, lost, plan, searchAnalytics, topic });
  const complete = isRecovered({ copies, lost });

  // A notice's corrections and annexes read without it would stand in for the whole notice.
  if (
    found.documents.some((document) => isNotice(document)) &&
    ![...stored, ...copies].some((source) => isNotice(source))
  ) {
    return { board: found.board, complete, sourceIds: [] };
  }

  const readable =
    requireOfficial && !stored.some((source) => source.kind === "official")
      ? copies
      : [...stored, ...copies];

  // The reading takes the first document as the notice whose hash the blueprint keeps.
  const sourceIds = readable
    .toSorted((first, second) => Number(isNotice(second)) - Number(isNotice(first)))
    .map((source) => source.sourceId);

  return { board: found.board, complete, sourceIds: [...new Set(sourceIds)] };
}

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

  const found = await findAndStoreSources({
    analytics,
    personalPlan,
    plan,
    requireOfficial: false,
    topic,
  });

  return found.sourceIds;
}

function toNothingFound(topic: ResearchSourceTopic): ResearchResult {
  return topic === "syllabus"
    ? { examBlueprintId: null, sourceIds: [], status: "ready" }
    : { reason: "noOfficialSource", status: "needsUpload" };
}

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

  // Uploads never change and syllabi are reused for a year.
  if (uploads.length === 0 && topic !== "syllabus") {
    await scheduleFreshnessChecksStep(
      sourceIds.map((sourceId) => ({ kind: "source" as const, sourceId })),
    );
  }

  return { examBlueprintId: null, sourceIds, status: "ready" };
}
