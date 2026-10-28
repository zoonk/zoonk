import { generateSourceChangeNotice } from "@zoonk/ai/tasks/v2/research/source-change-notice";
import { type ReadingCheck } from "@zoonk/core/library/exams/blueprint-contract";
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

type ReadingCheckInput = Omit<ReadingCheck, "checkedAt">;

function withCheck({
  check,
  reading,
}: {
  check: ReadingCheckInput | null;
  reading: BlueprintReading;
}): BlueprintReading {
  if (!check) {
    return reading;
  }

  const edition = {
    ...reading.content.edition,
    check: { ...check, checkedAt: new Date().toISOString() },
  };

  return { ...reading, content: { ...reading.content, edition } };
}

export async function saveBlueprintStep({
  analytics,
  check,
  identity,
  reading: unchecked,
  sourceId,
}: {
  analytics: ResearchAnalytics;
  check: ReadingCheckInput | null;
  identity: ExamIdentity;
  reading: BlueprintReading;
  sourceId: string;
}): Promise<{
  created: boolean;
  examBlueprintId: string;
  movesExamDays: boolean;
  noticeId: string | null;
}> {
  "use step";

  const reading = withCheck({ check, reading: unchecked });
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
    created: saved.created,
    examBlueprintId: saved.blueprint.id,
    movesExamDays: saved.movesExamDays,
    noticeId: saved.noticeId,
  };
}
