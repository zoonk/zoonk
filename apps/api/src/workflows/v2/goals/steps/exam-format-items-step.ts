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

  // A skill with nothing to work out gets no numeric questions, so it's recorded and not asked again.
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
