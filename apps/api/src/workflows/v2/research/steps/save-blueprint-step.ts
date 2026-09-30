import { generateSourceChangeNotice } from "@zoonk/ai/tasks/v2/research/source-change-notice";
import { type ExamIdentity } from "@zoonk/core/library/exams/identity";
import {
  type BlueprintNotice,
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
  reading,
  sourceId,
}: {
  analytics: ResearchAnalytics;
  identity: ExamIdentity;
  reading: BlueprintReading;
  sourceId: string;
}): Promise<{ changedFields: string[]; created: boolean; examBlueprintId: string }> {
  "use step";

  const notice = await writeNotice({ analytics, identity, reading });

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
    changedFields: saved.changes.map((change) => change.field),
    created: saved.created,
    examBlueprintId: saved.blueprint.id,
  };
}
