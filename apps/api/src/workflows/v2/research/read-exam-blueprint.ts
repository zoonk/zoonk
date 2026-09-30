import { type ExamIdentity } from "@zoonk/core/library/exams/identity";
import { type ResearchAnalytics } from "./_utils/research-analytics";
import { extractBlueprintStep } from "./steps/extract-blueprint-step";
import { saveBlueprintStep } from "./steps/save-blueprint-step";

export type SavedBlueprint = { changedFields: string[]; created: boolean; examBlueprintId: string };

function describeExam(identity: ExamIdentity): string {
  return identity.role ? `${identity.name}, ${identity.role}` : identity.name;
}

/**
 * Reads the exam's documents and saves what both citation checks kept. A new
 * exam needs a usable reading, or research asks the learner for the notice
 * instead of storing a guess. An existing blueprint is saved either way: an
 * unusable reading changes nothing but records the notice's new hash, so the
 * next check doesn't pay for the same reading again.
 */
export async function readExamBlueprint({
  analytics,
  identity,
  isNew,
  priority,
  sourceIds,
}: {
  analytics: ResearchAnalytics;
  identity: ExamIdentity;
  isNew: boolean;
  /** A learner's plan waits on research's reading; a freshness check's waits on nothing. */
  priority: boolean;
  sourceIds: string[];
}): Promise<SavedBlueprint | null> {
  const [noticeId] = sourceIds;

  if (!noticeId) {
    return null;
  }

  const reading = await extractBlueprintStep({
    analytics,
    exam: describeExam(identity),
    priority,
    sourceIds,
  });

  if (isNew && !reading.usable) {
    return null;
  }

  return saveBlueprintStep({ analytics, identity, reading, sourceId: noticeId });
}
