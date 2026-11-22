import "server-only";
import { type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import {
  type CourseLevel,
  type ExamBlueprint,
  type Goal,
  type ItemFormat,
  prisma,
} from "@zoonk/db";
import { toListeningExam } from "../exams/listening/listening-exam";
import { getListeningSkillIds } from "../exams/listening/listening-skills";
import {
  LOW_GUESS_ANSWERS_TO_SKIP,
  isLowGuessTap,
  isQuickChoice,
} from "../learner/_utils/placement-guess-rate";
import { wantsPlacementQuestions } from "../learner/placement/focus-test-state";
import { getKnownSubjects, getOwnLevel } from "../learner/placement/placement-contract";
import { pickPlacementItemSkillIds } from "../learner/placement/placement-item-picks";
import { isOwnMaterialTest } from "../learner/placement/placement-material";
import {
  type PlacementQuickFormat,
  getConfirmingCount,
  getPlacementQuickFormat,
} from "../learner/placement/placement-quick-format";
import { fitsExamChoice, fitsExamOptions } from "../library/exams/exam-choice-format";
import { getItemAudienceFilter } from "../library/items/item-field";
import { loadUsedSituations } from "../library/items/used-situations";
import { loadSkillPrerequisites } from "../library/skills/skill-prerequisites";
import { parsePlanGraph, parsePlanSettings } from "../plans/planner/plan-state";
import { type PlacementChoice, type PlacementItemExam, getPickingExam } from "./item-exam";

export const PLACEMENT_ITEM_SKILL_SELECT = {
  country: true,
  description: true,
  id: true,
  language: true,
  level: true,
  name: true,
  ownerId: true,
  targetLanguage: true,
} as const;

export type PlacementItemSkill = {
  country: string | null;
  description: string;
  exam: PlacementItemExam | null;
  id: string;
  language: string;
  level: CourseLevel | null;
  name: string;
  /** Set for a private course's skill, whose questions are personal content. */
  ownerId: string | null;
  /** The language a language goal's skill practices ("en"); its questions are in it. */
  targetLanguage: string | null;
  /** Openings of every question the goal's learner can be served for the skill, so new cases do not repeat one under other names. */
  usedSituations: string[];
};

type PickingGoal = Pick<Goal, "details"> & {
  examBlueprint: ExamBlueprint | null;
  plan: { graph: unknown; settings: unknown } | null;
};

async function readPickedSkillIds({
  forPlacement,
  goal,
  listeningSkillIds,
  skillIds,
}: {
  forPlacement: boolean;
  goal: PickingGoal | null;
  listeningSkillIds: ReadonlySet<string>;
  skillIds?: string[];
}): Promise<string[]> {
  if (forPlacement && goal && !wantsPlacementQuestions(goal)) {
    return [];
  }

  if (skillIds) {
    return [...new Set(skillIds)].filter((skillId) => !listeningSkillIds.has(skillId));
  }

  const graph = parsePlanGraph(goal?.plan?.graph);

  return pickPlacementItemSkillIds({
    everySkill: isOwnMaterialTest(goal?.examBlueprint ?? null),
    focusAreas: parsePlanSettings(goal?.plan?.settings).focusAreas,
    graph,
    knownAreas: goal ? getKnownSubjects(goal) : [],
    listeningSkillIds,
    ownLevel: goal ? getOwnLevel({ goal }) : null,
    prerequisites: await loadSkillPrerequisites(graph.skills.map((skill) => skill.skillId)),
  });
}

/** `tap` is a low-guess tap question (`isLowGuessTap`): match pairs, an order or a select-all. */
export type PlacementItemFormat = PlacementQuickFormat | "tap";

export type PlacementItemPick = PlacementItemSkill & { needsQuick: boolean; tapsNeeded: number };

export type PlacementItemPicks = {
  /** The quick questions each picked skill gets beyond the first (`getConfirmingCount`). */
  confirmingCount: number;
  quickFormat: PlacementQuickFormat;
  skills: PlacementItemPick[];
};

/** The writer asks for these shapes, but only one a blind guess rarely passes can confirm a skill. */
export function isTapWorthStoring(item: GeneratedItem): boolean {
  return isLowGuessTap({
    content: item.format === "multipleChoice" ? { ...item, select: "all" } : item,
    format: item.format,
  });
}

/** A select-all multiple-choice question is a tap question, never a quick one. */
function isQuickChoiceOrStatement(item: SkillItem): boolean {
  return item.format === "trueFalse" || isQuickChoice(item);
}

function isQuickFormat(format: PlacementItemFormat): format is PlacementQuickFormat {
  return format !== "tap";
}

type SkillItem = {
  attempts: { id: string }[];
  content: unknown;
  examBlueprintId: string | null;
  format: ItemFormat;
};

type SkillRow = Omit<PlacementItemSkill, "exam" | "usedSituations"> & { items: SkillItem[] };

function isAnswered(item: SkillItem): boolean {
  return item.attempts.length > 0;
}

/** Questions incompatible with the goal's current format or option count do not satisfy coverage. */
function toPick({
  coversQuick,
  coversTap,
  exam,
  exceptAnswered,
  quickNeeded,
  row,
  writesQuick,
  writesTaps,
}: {
  coversQuick: (item: SkillItem) => boolean;
  coversTap: (item: SkillItem) => boolean;
  exam: PlacementItemExam | null;
  /** Questions the goal's learner already answered don't cover the skill: they won't be asked. */
  exceptAnswered: boolean;
  quickNeeded: number;
  row: SkillRow;
  writesQuick: boolean;
  writesTaps: boolean;
}): Omit<PlacementItemPick, "usedSituations"> | null {
  const unanswered = row.items.filter((item) => !(exceptAnswered && isAnswered(item)));

  const needsQuick =
    writesQuick && unanswered.filter((item) => coversQuick(item)).length < quickNeeded;

  const tapsNeeded = writesTaps
    ? Math.max(0, LOW_GUESS_ANSWERS_TO_SKIP - unanswered.filter((item) => coversTap(item)).length)
    : 0;

  if (!needsQuick && tapsNeeded === 0) {
    return null;
  }

  return {
    country: row.country,
    description: row.description,
    exam,
    id: row.id,
    language: row.language,
    level: row.level,
    name: row.name,
    needsQuick,
    ownerId: row.ownerId,
    tapsNeeded,
    targetLanguage: row.targetLanguage,
  };
}

/** Workflow bridge: goalId must come from the authenticated boundary. formats narrows generation; exceptAnswered excludes seen questions from coverage. */
export async function pickPlacementItemSkills({
  choice,
  exceptAnswered = false,
  forPlacement = false,
  formats,
  goalId,
  quickNeeded = 1,
  skillIds,
}: {
  choice?: PlacementChoice;
  /** Questions the goal's learner already answered don't count: they won't be asked again. */
  exceptAnswered?: boolean;
  /** Only placement respects an explicit placement skip; tests and practice may still request questions. Placement writes tap questions unless `formats` says otherwise. */
  forPlacement?: boolean;
  formats?: readonly PlacementItemFormat[];
  goalId: string;
  /** Required quick-question count before skipping a covered skill; excludes confirming questions. */
  quickNeeded?: number;
  skillIds?: string[];
}): Promise<PlacementItemPicks> {
  const goal = await prisma.goal.findUnique({
    select: {
      details: true,
      examBlueprint: true,
      kind: true,
      plan: { select: { graph: true, settings: true } },
      targetLanguage: true,
      userId: true,
    },
    where: { id: goalId },
  });

  const listeningSkillIds = goal
    ? getListeningSkillIds({ exam: toListeningExam(goal), graph: parsePlanGraph(goal.plan?.graph) })
    : new Set<string>();

  const picked = await readPickedSkillIds({ forPlacement, goal, listeningSkillIds, skillIds });

  const blueprint = goal?.examBlueprint ?? null;
  const writesQuick = !formats || formats.some((format) => isQuickFormat(format));
  const writesTaps = formats ? formats.includes("tap") : forPlacement;

  /**
   * Placement and tap questions ask whether the learner has the skill, not the exam's format, so
   * they're general ones every course and exam teaching the skill shares. Mocks, test-outs and
   * challenges ask their own formats.
   */
  const general = forPlacement || !writesQuick;

  const {
    choices,
    exam,
    formats: structure,
  } = general ? { choices: [], exam: null, formats: null } : getPickingExam({ choice, goal });

  const fits = (item: SkillItem) =>
    formats ? fitsExamOptions({ choices, item }) : fitsExamChoice({ choices, item });

  /** Without asked formats, an exam writes its own questions even where general ones exist. */
  const ownExamOnly = Boolean(exam && !formats);

  const quickFormat =
    formats?.find((format) => isQuickFormat(format)) ?? getPlacementQuickFormat(structure);

  const confirmingCount = getConfirmingCount({
    forPlacement,
    formats: formats?.filter((format) => isQuickFormat(format)),
    quickFormat,
    writesTyped: writesTaps,
  });

  const fitsAudience = (item: SkillItem) =>
    !ownExamOnly || item.examBlueprintId === exam?.blueprintId;

  const coversQuick = (item: SkillItem) =>
    item.format === quickFormat &&
    isQuickChoiceOrStatement(item) &&
    fitsAudience(item) &&
    fits(item);

  const coversTap = (item: SkillItem) => isLowGuessTap(item) && fitsAudience(item);

  const skills = await prisma.skill.findMany({
    select: {
      country: true,
      description: true,
      id: true,
      items: {
        orderBy: { createdAt: "desc" },
        select: {
          attempts: {
            select: { id: true },
            take: 1,
            where: { userId: { in: goal ? [goal.userId] : [] } },
          },
          content: true,
          examBlueprintId: true,
          format: true,
        },
        where: getItemAudienceFilter({ examBlueprintId: blueprint?.id ?? null }),
      },
      language: true,
      level: true,
      name: true,
      ownerId: true,
      targetLanguage: true,
    },
    where: { id: { in: picked } },
  });

  const rules = { coversQuick, coversTap, exam, exceptAnswered, writesQuick, writesTaps };

  const picks = picked
    .map((id) => skills.find((row) => row.id === id))
    .map((row) =>
      row ? toPick({ ...rules, quickNeeded: quickNeeded + confirmingCount, row }) : null,
    )
    .filter((pick) => pick !== null);

  const usedSituations = await loadUsedSituations({
    examBlueprintId: blueprint?.id,
    includeMockReserve: true,
    skillIds: picks.map((pick) => pick.id),
  });

  return {
    confirmingCount,
    quickFormat,
    skills: picks.map((pick) => ({ ...pick, usedSituations: usedSituations.get(pick.id) ?? [] })),
  };
}

export async function readPlacementPlanRunId(goalId: string): Promise<string | null> {
  const plan = await prisma.plan.findUnique({ select: { runId: true }, where: { goalId } });
  return plan?.runId ?? null;
}

/** A previous curriculum's question writer cannot finish waiting for the rebuilt curriculum. */
export async function recordPlacementPrepared({
  goalId,
  placementPart,
  planRunId,
}: {
  goalId: string;
  placementPart?: { attemptId: string; part: number };
  planRunId: string | null;
}): Promise<void> {
  if (placementPart) {
    await prisma.$executeRaw`
      UPDATE goals
      SET details = jsonb_set(details, '{placementTest,attempt,partPrepared}', 'true'::jsonb)
      WHERE id = ${goalId}::uuid
        AND details #>> '{placementTest,attempt,id}' = ${placementPart.attemptId}
        AND details #>> '{placementTest,attempt,part}' = ${String(placementPart.part)}
    `;

    return;
  }

  await prisma.plan.updateMany({
    data: { placementPreparedAt: new Date() },
    where: { goalId, runId: planRunId },
  });
}
