import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import { generateItems } from "@zoonk/ai/tasks/items/generate";
import { type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import { type KeyCheckedItem } from "@zoonk/core/library/items/check-keys";
import { createItems } from "@zoonk/core/library/items/create";
import { recordNumericWrite } from "@zoonk/core/library/items/numeric-skills";
import {
  type ExamFormatPick,
  pickExamFormatSkills,
} from "@zoonk/core/lookahead/exam-format-skills";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { startPictureChecks } from "../../images/start-picture-checks";
import { checkItemKeysStep } from "./item-keys-step";

/** Enough of a skill's questions in one format for a week of practice and a mock. */
const EXAM_FORMAT_ITEMS_PER_SKILL = 4;

type ExamFormatWrite = {
  analytics?: ContentAnalytics;
  pick: ExamFormatPick;
  workflowRunId: string;
};

type WrittenItems = Awaited<ReturnType<typeof generateItems>>;

function getExam({ answerFormat, skill, style }: ExamFormatPick) {
  return (
    skill.exam && {
      ...skill.exam,
      optionCount: answerFormat.options ?? skill.exam.optionCount,
      style: style ?? skill.exam.style,
    }
  );
}

function getOptionCount(pick: ExamFormatPick): number | null {
  return pick.answerFormat.format === "multipleChoice"
    ? (getExam(pick)?.optionCount ?? null)
    : null;
}

export async function pickExamFormatSkillsStep(goalId: string): Promise<ExamFormatPick[]> {
  "use step";

  return pickExamFormatSkills({ goalId });
}

async function writeExamFormatItemsStep({
  analytics,
  count,
  pick,
  wait,
  workflowRunId,
}: ExamFormatWrite & { count: number; wait: CallWait }): Promise<{
  items: GeneratedItem[];
  provenance: WrittenItems["provenance"];
}> {
  "use step";

  const { entry, format, select } = pick.answerFormat;
  const exam = getExam(pick);
  const { skill } = pick;

  const { data, provenance } = await generateItems({
    analytics: toContentAnalytics({ analytics, scope: skill, workflowRunId }),
    count,
    country: skill.country,
    examFormat: exam ? { ...exam, entry, select } : null,
    format,
    language: skill.language,
    level: skill.level ?? "intermediate",
    serviceTier: chooseServiceTier({ wait }),
    skill: { description: skill.description, name: skill.name },
    targetLanguage: skill.targetLanguage,
    usedSituations: skill.usedSituations,
  });

  return { items: data.items, provenance };
}

async function storeExamFormatItemsStep({
  analytics,
  generated,
  items,
  pick,
  provenance,
  workflowRunId,
}: ExamFormatWrite & {
  generated: number;
  items: KeyCheckedItem[];
  provenance: WrittenItems["provenance"];
}): Promise<number> {
  "use step";

  const { entry, format, select } = pick.answerFormat;
  const { skill } = pick;
  const context = toContentAnalytics({ analytics, scope: skill, workflowRunId });

  const { created, unchecked } = await createItems({
    analytics: context,
    entry: entry ?? undefined,
    examBlueprintId: getExam(pick)?.blueprintId ?? null,
    format,
    items,
    language: skill.language,
    optionCount: getOptionCount(pick),
    optionLanguage: skill.targetLanguage,
    provenance,
    select: select ?? undefined,
    skillId: skill.id,
  });

  // A skill with nothing to work out gets no numeric questions, so it's recorded and not asked again.
  await Promise.all([
    startPictureChecks({ analytics: context, assetIds: unchecked }),
    format === "numeric"
      ? recordNumericWrite({ created: created.length, generated, skillId: skill.id })
      : null,
  ]);

  return created.length;
}

export async function prepareSkillExamFormatItems({
  analytics,
  count = EXAM_FORMAT_ITEMS_PER_SKILL,
  pick,
  wait = "later",
  workflowRunId,
}: ExamFormatWrite & { count?: number; wait?: CallWait }): Promise<number> {
  const { skill } = pick;
  const written = await writeExamFormatItemsStep({ analytics, count, pick, wait, workflowRunId });

  const { kept } = await checkItemKeysStep({
    analytics: toContentAnalytics({ analytics, scope: skill, workflowRunId }),
    items: written.items,
    language: skill.language,
    optionCount: getOptionCount(pick),
    optionLanguage: skill.targetLanguage,
    select: pick.answerFormat.select ?? undefined,
    wait,
  });

  return storeExamFormatItemsStep({
    analytics,
    generated: written.items.length,
    items: kept.map(({ item }) => item),
    pick,
    provenance: written.provenance,
    workflowRunId,
  });
}
