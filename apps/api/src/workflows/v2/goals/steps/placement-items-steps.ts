import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type PlacementSkillItems,
  generatePlacementItems,
} from "@zoonk/ai/tasks/v2/items/placement-items";
import { getContentReuse } from "@zoonk/core/library/curriculum/scope";
import { createItems } from "@zoonk/core/library/items/create";
import {
  type PlacementItemFormat,
  type PlacementItemPick,
  type PlacementItemPicks,
  pickPlacementItemSkills,
} from "@zoonk/core/lookahead/placement-item-skills";
import { isGoalInPlacementWeek } from "@zoonk/core/lookahead/placement-week";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { startPictureChecks } from "../../images/start-picture-checks";
import { toPlacementItemBatches } from "../placement-item-batches";

/**
 * What placement writes for each skill it picked. One quick question is what day 1 and the first
 * week's sessions ask of a skill before moving on. A right quick answer is confirmed by the
 * skill's other quick questions, written in the same call (`confirmingCount`: a second
 * multiple-choice pick takes a skill from 78% to 93% sure, past the 80% placement needs), or, for
 * a language goal, by one typed question. A skill placement can't ask again is left to lessons and
 * reviews, whose answers count too.
 */
const PLACEMENT_ITEMS_PER_SKILL = { quick: 1, typed: 1 } as const;

export const DEFAULT_QUICK_COUNT = PLACEMENT_ITEMS_PER_SKILL.quick;

type WriteContext = { analytics?: ContentAnalytics; workflowRunId: string };

type PlacementQuickFormat = PlacementItemPicks["quickFormat"];

type PlacementProvenance = Awaited<ReturnType<typeof generatePlacementItems>>["provenance"];

type PlacementAnalytics = ReturnType<typeof toContentAnalytics>;

/** Stores one skill's questions in one format; they join the shared item bank. */
async function storeSkillItems({
  analytics,
  format,
  items,
  provenance,
  skill,
}: {
  analytics: PlacementAnalytics;
  format: PlacementItemFormat;
  items: PlacementSkillItems["quick"];
  provenance: PlacementProvenance;
  skill: PlacementItemPick;
}): Promise<number> {
  const { exam } = skill;

  const { created, unchecked } = await createItems({
    analytics,
    examBlueprintId: exam?.blueprintId ?? null,
    format,
    items,
    language: skill.language,
    optionCount: format === "multipleChoice" ? (exam?.optionCount ?? null) : null,
    provenance,
    skillId: skill.id,
  });

  // Questions are asked as soon as they're stored; their new pictures are checked meanwhile.
  await startPictureChecks({ analytics, assetIds: unchecked });

  return created.length;
}

/** Whether placement can now ask the skill: its quick question passed the checks and was stored. */
async function storePlacementItems({
  analytics,
  items,
  provenance,
  quickFormat,
  skill,
}: {
  analytics: PlacementAnalytics;
  items: PlacementSkillItems;
  provenance: PlacementProvenance;
  quickFormat: PlacementQuickFormat;
  skill: PlacementItemPick;
}): Promise<boolean> {
  const [quick] = await Promise.all([
    storeSkillItems({ analytics, format: quickFormat, items: items.quick, provenance, skill }),
    skill.needsTyped
      ? storeSkillItems({ analytics, format: "typed", items: items.typed, provenance, skill })
      : null,
  ]);

  return quick > 0;
}

export type PlacementItemsRequest = WriteContext & {
  /** Questions the goal's learner answered don't count, as a focus test never asks them again. */
  exceptAnswered?: boolean;
  /** Placement's own questions, none for a learner who skipped it (`pickPlacementItemSkills`). */
  forPlacement?: boolean;
  formats?: readonly PlacementItemFormat[];
  goalId: string;
  /** Nobody waits: the questions are asked in the next days' sessions, at the flex tier. */
  later?: boolean;
  quickCount?: number;
  /** How many quick questions a skill already needs to have before it's skipped. */
  quickNeeded?: number;
  skillIds?: string[];
};

/**
 * The skills that still need placement's questions (see `pickPlacementItemSkills`), in the
 * batches one model call writes each (`toPlacementItemBatches`), in pick order.
 */
export async function pickPlacementBatchesStep({
  exceptAnswered,
  forPlacement,
  formats,
  goalId,
  quickCount = DEFAULT_QUICK_COUNT,
  quickNeeded,
  skillIds,
}: PlacementItemsRequest): Promise<{
  batches: PlacementItemPick[][];
  confirmingCount: number;
  quickFormat: PlacementQuickFormat;
}> {
  "use step";

  const { confirmingCount, quickFormat, skills } = await pickPlacementItemSkills({
    exceptAnswered,
    forPlacement,
    formats,
    goalId,
    quickNeeded,
    skillIds,
  });

  // Confirming questions ride along like typed ones: the batches follow the questions asked first.
  return { batches: toPlacementItemBatches({ quickCount, skills }), confirmingCount, quickFormat };
}

/**
 * Writes placement's questions for a batch of skills in one call, then stores each skill's:
 * returns how many of them placement can now ask. A call that fails fails the step, which the
 * runtime retries once, right away (the learner is waiting, so there's no backoff), apart from the
 * batch's neighbors, whose questions are already stored.
 */
export async function writePlacementBatchStep({
  analytics,
  confirmingCount = 0,
  quickCount,
  quickFormat,
  skills,
  wait = "soon",
  workflowRunId,
}: WriteContext & {
  /** Quick questions each skill gets beyond `quickCount`, to confirm a right answer. */
  confirmingCount?: number;
  quickCount: number;
  quickFormat: PlacementQuickFormat;
  skills: PlacementItemPick[];
  /** `learner` for the batch the first question waits on; the rest are asked minutes later. */
  wait?: CallWait;
}): Promise<number> {
  "use step";

  const [first] = skills;

  if (!first) {
    return 0;
  }

  // The questions join the shared bank: an exam's or a language's are very likely asked again.
  const serviceTier = chooseServiceTier({
    reuse: getContentReuse({
      forExam: first.exam !== null,
      ownerId: first.ownerId,
      targetLanguage: first.targetLanguage,
    }),
    wait,
  });

  const { data, provenance } = await generatePlacementItems({
    analytics: toContentAnalytics({ analytics, scope: first, workflowRunId }),
    examFormat: first.exam,
    language: first.language,
    quickCount: quickCount + confirmingCount,
    quickFormat,
    serviceTier,
    skills: skills.map((skill) => ({
      description: skill.description,
      level: skill.level ?? "beginner",
      name: skill.name,
      usedSituations: skill.usedSituations,
    })),
    targetLanguage: first.targetLanguage,
    typedCount: first.needsTyped ? PLACEMENT_ITEMS_PER_SKILL.typed : 0,
  });

  const stored = await Promise.allSettled(
    skills.map((skill, index) =>
      storePlacementItems({
        analytics: toContentAnalytics({ analytics, scope: skill, workflowRunId }),
        items: data.skills[index] ?? { quick: [], typed: [] },
        provenance,
        quickFormat,
        skill,
      }),
    ),
  );

  return stored.filter((result) => result.status === "fulfilled" && result.value).length;
}

writePlacementBatchStep.maxRetries = 1;

/** Whether the goal is in placement's first week, in its learner's time zone (`isGoalInPlacementWeek`). */
export async function isGoalInPlacementWeekStep(input: {
  goalId: string;
  timeZone: string;
}): Promise<boolean> {
  "use step";

  return isGoalInPlacementWeek(input);
}
