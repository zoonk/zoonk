import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import { generateItems } from "@zoonk/ai/tasks/v2/items/generate";
import { getContentReuse } from "@zoonk/core/library/curriculum/scope";
import { createItems } from "@zoonk/core/library/items/create";
import { recordNumericWrite } from "@zoonk/core/library/items/numeric-skills";
import {
  type ExamFormatPick,
  pickExamFormatSkills,
} from "@zoonk/core/lookahead/exam-format-skills";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { startPictureChecks } from "../../images/start-picture-checks";

/** Enough of a skill's questions in one format for a week of practice and a mock. */
const EXAM_FORMAT_ITEMS_PER_SKILL = 4;

export async function pickExamFormatSkillsStep(goalId: string): Promise<ExamFormatPick[]> {
  "use step";

  return pickExamFormatSkills({ goalId });
}

/**
 * Writes a skill's questions in one of its exam's own answer formats (JEE Advanced's "one or more
 * correct options", the SAT's grid-ins, JEE Main's integer answers), checked and stored with how
 * they're answered. They join the shared bank under the exam, for every learner of that exam.
 * Nobody waits on them unless `wait` says so: practice and mocks ask them in the days ahead, and
 * a mock starting now writes the `count` it's short of while the learner waits.
 */
export async function prepareExamFormatItemsStep({
  analytics,
  count = EXAM_FORMAT_ITEMS_PER_SKILL,
  pick,
  wait = "later",
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  count?: number;
  pick: ExamFormatPick;
  wait?: CallWait;
  workflowRunId: string;
}): Promise<number> {
  "use step";

  const { answerFormat, skill } = pick;
  const { entry, format, select } = answerFormat;
  const context = toContentAnalytics({ analytics, scope: skill, workflowRunId });

  const { data, provenance } = await withAiRetry(() =>
    generateItems({
      analytics: context,
      count,
      examFormat: skill.exam ? { ...skill.exam, entry, select } : null,
      format,
      language: skill.language,
      level: skill.level ?? "intermediate",
      // The questions join the exam's shared bank, so a learner waiting on them gets priority.
      serviceTier: chooseServiceTier({
        reuse: getContentReuse({
          forExam: skill.exam !== null,
          ownerId: skill.ownerId,
          targetLanguage: skill.targetLanguage,
        }),
        wait,
      }),
      skill: { description: skill.description, name: skill.name },
    }),
  );

  const { created, unchecked } = await createItems({
    analytics: context,
    entry: entry ?? undefined,
    examBlueprintId: skill.exam?.blueprintId ?? null,
    format,
    items: data.items,
    language: skill.language,
    optionCount: format === "multipleChoice" ? (skill.exam?.optionCount ?? null) : null,
    provenance,
    select: select ?? undefined,
    skillId: skill.id,
  });

  // The writer returns no numbers for a skill that has none to work out, so it isn't asked again.
  await Promise.all([
    startPictureChecks({ analytics: context, assetIds: unchecked }),
    format === "numeric"
      ? recordNumericWrite({
          created: created.length,
          generated: data.items.length,
          skillId: skill.id,
        })
      : null,
  ]);

  return created.length;
}
