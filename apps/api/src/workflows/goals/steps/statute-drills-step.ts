import {
  STATUTE_DRILL_OPTION_COUNT,
  type StatuteDrill,
  generateStatuteDrills,
} from "@zoonk/ai/tasks/items/statute-drills";
import {
  type StatuteDrillTarget,
  checkStatuteDrillKeys,
  loadStatuteDrillTargets,
  writeStatuteDrills,
} from "@zoonk/core/exams/statutes/drill-targets";
import { type KeyCheckedItem } from "@zoonk/core/library/items/check-keys";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";

/** A first set per law: enough for a few days of drills, more as the plan reaches the law. */
const DRILLS_PER_LAW = 12;

type LawDrillsWrite = {
  analytics?: ContentAnalytics;
  target: StatuteDrillTarget;
  workflowRunId: string;
};

type WrittenDrills = Awaited<ReturnType<typeof generateStatuteDrills>>;

function toDrillAnalytics({ analytics, workflowRunId }: LawDrillsWrite) {
  return toContentAnalytics({ analytics, scope: { ownerId: null }, workflowRunId });
}

export async function loadStatuteDrillTargetsStep(goalId: string): Promise<StatuteDrillTarget[]> {
  "use step";

  return loadStatuteDrillTargets(goalId);
}

async function writeLawDrillsStep(
  input: LawDrillsWrite,
): Promise<{ drills: StatuteDrill[]; provenance: WrittenDrills["provenance"] }> {
  "use step";

  const { target } = input;

  const { data, provenance } = await generateStatuteDrills({
    analytics: toDrillAnalytics(input),
    articles: target.articles,
    count: DRILLS_PER_LAW,
    fillInTheBlank: target.fillInTheBlank,
    language: target.language,
    law: target.law,
    style: target.style,
  });

  return { drills: data.drills, provenance };
}

async function checkLawDrillsStep({
  drills,
  ...input
}: LawDrillsWrite & { drills: StatuteDrill[] }): Promise<KeyCheckedItem<StatuteDrill>[]> {
  "use step";

  const { target } = input;

  return checkStatuteDrillKeys({
    analytics: toDrillAnalytics(input),
    articles: target.articles,
    drills,
    language: target.language,
    law: target.law,
    optionCount: STATUTE_DRILL_OPTION_COUNT,
  });
}

async function storeLawDrillsStep({
  drills,
  provenance,
  target,
}: LawDrillsWrite & {
  drills: KeyCheckedItem<StatuteDrill>[];
  provenance: WrittenDrills["provenance"];
}): Promise<number> {
  "use step";

  return writeStatuteDrills({
    drills,
    optionCount: STATUTE_DRILL_OPTION_COUNT,
    provenance,
    target,
  });
}

export async function prepareLawDrills(input: LawDrillsWrite): Promise<number> {
  const { drills, provenance } = await writeLawDrillsStep(input);
  const kept = await checkLawDrillsStep({ ...input, drills });

  return storeLawDrillsStep({ ...input, drills: kept, provenance });
}
