import { generateSourceChangeNotice } from "@zoonk/ai/tasks/v2/research/source-change-notice";
import { type ExamIdentity } from "@zoonk/core/library/exams/identity";
import {
  type BlueprintNotice,
  isPastEdition,
  previewExamBlueprintChanges,
  saveExamBlueprint,
} from "@zoonk/core/library/exams/save";
import { recordReusePolicy } from "@zoonk/core/library/sources/record-reuse-policy";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";
import { type BlueprintReading } from "./extract-blueprint-step";

/** Changed sections as the notice model reads them: old and new values, without citations. */
function formatChanges(changes: { after: unknown; before: unknown; field: string }[]): string {
  return JSON.stringify(changes, null, 2);
}

async function writeNotice({
  analytics,
  identity,
  reading,
}: {
  analytics: ResearchAnalytics;
  identity: ExamIdentity;
  reading: BlueprintReading;
}): Promise<BlueprintNotice | null> {
  // A notice read again after its exam (the next one isn't out) tells learners nothing to act on.
  if (isPastEdition({ content: reading.content })) {
    return null;
  }

  const changes = await previewExamBlueprintChanges({ content: reading.content, identity });

  if (!changes || changes.length === 0) {
    return null;
  }

  const { data, provenance } = await withAiRetry(() =>
    generateSourceChangeNotice({
      analytics,
      changes: formatChanges(changes),
      language: identity.language,
      source: identity.role ? `${identity.name}, ${identity.role}` : identity.name,
    }),
  );

  return { message: data.message, provenance };
}

/**
 * Stores the blueprint, or updates only what changed on the existing one. A
 * change also gets its one-line notice for the exam's learners, written only
 * when something actually changed.
 */
export async function saveBlueprintStep({
  analytics,
  identity,
  quiet = false,
  reading,
  sourceId,
}: {
  analytics: ResearchAnalytics;
  identity: ExamIdentity;
  /** A reading by newer instructions of an edition already read: no learner notice. */
  quiet?: boolean;
  reading: BlueprintReading;
  sourceId: string;
}): Promise<{
  created: boolean;
  examBlueprintId: string;
  /** The reading moved the exam's own days, which the exam's learners get as a change to apply. */
  movesExamDays: boolean;
  noticeId: string | null;
}> {
  "use step";

  const notice = quiet ? null : await writeNotice({ analytics, identity, reading });

  const saved = await saveExamBlueprint({
    content: reading.content,
    identity,
    notice,
    provenance: reading.provenance,
    sourceId,
  });

  if (reading.reusePolicy) {
    await recordReusePolicy(reading.reusePolicy);
  }

  return {
    created: saved.created,
    examBlueprintId: saved.blueprint.id,
    movesExamDays: saved.movesExamDays,
    noticeId: saved.noticeId,
  };
}
