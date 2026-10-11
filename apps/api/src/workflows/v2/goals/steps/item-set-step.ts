import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { writeItemSet } from "@zoonk/ai/tasks/v2/items/write-set";
import { storeWrittenItemSet } from "@zoonk/core/library/items/store-set";
import { type ItemSetTarget, pickItemSetTargets } from "@zoonk/core/lookahead/item-set-targets";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";

/** Questions on one stimulus: enough to need reading it well, few enough for one sitting. */
const QUESTIONS_PER_SET = { multipleChoice: 3, trueFalse: 4 } as const;

export async function pickItemSetTargetsStep(goalId: string): Promise<ItemSetTarget[]> {
  "use step";

  return pickItemSetTargets({ goalId });
}

/**
 * Writes one question set for an exam (an original passage, case or chart, and questions on an
 * area's skills that each need it), checks it and stores it in the shared bank under the exam, for
 * every learner of that exam. Nobody waits on it: practice and mocks ask it in the days ahead.
 * Returns whether a set was stored; one that fails its checks is left out.
 */
export async function prepareItemSetStep({
  analytics,
  target,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  target: ItemSetTarget;
  workflowRunId: string;
}): Promise<boolean> {
  "use step";

  const [first] = target.skills;

  if (!first) {
    return false;
  }

  const { format, skills, usedTitles } = target;
  const context = toContentAnalytics({ analytics, scope: first, workflowRunId });

  const { data, provenance } = await withAiRetry(() =>
    writeItemSet({
      analytics: context,
      examFormat: first.exam,
      format,
      language: first.language,
      questionCount: QUESTIONS_PER_SET[format],
      serviceTier: chooseServiceTier({ wait: "later" }),
      skills: skills.map((skill) => ({
        description: skill.description,
        level: skill.level ?? "intermediate",
        name: skill.name,
      })),
      usedTitles,
    }),
  );

  const stored = await storeWrittenItemSet({
    examBlueprintId: first.exam?.blueprintId ?? null,
    format,
    language: first.language,
    optionCount: format === "multipleChoice" ? (first.exam?.optionCount ?? null) : null,
    provenance,
    skillIds: skills.map((skill) => skill.id),
    written: data,
  });

  return stored.setId !== null;
}
