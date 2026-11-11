import "server-only";
import {
  type CourseLevel,
  type ExamBlueprint,
  type Goal,
  type ItemFormat,
  prisma,
} from "@zoonk/db";
import { toListeningExam } from "../exams/listening/listening-exam";
import { getListeningSkillIds } from "../exams/listening/listening-skills";
import { wantsPlacementQuestions } from "../learner/placement/focus-test-state";
import { getKnownSubjects, getOwnLevel } from "../learner/placement/placement-contract";
import { pickPlacementItemSkillIds } from "../learner/placement/placement-item-picks";
import { isOwnMaterialTest } from "../learner/placement/placement-material";
import {
  type PlacementQuickFormat,
  confirmsInWriting,
  getConfirmingCount,
  getPlacementQuickFormat,
} from "../learner/placement/placement-quick-format";
import { fitsExamChoice, fitsExamOptions } from "../library/exams/exam-choice-format";
import { getItemAudienceFilter } from "../library/items/item-field";
import { loadUsedSituations } from "../library/items/used-situations";
import { loadSkillPrerequisites } from "../library/skills/skill-prerequisites";
import { parsePlanGraph, parsePlanSettings } from "../plans/planner/plan-state";
import { type PlacementChoice, type PlacementItemExam, getPickingExam } from "./item-exam";

export type PlacementItemSkill = {
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

export type PlacementItemFormat = PlacementQuickFormat | "typed";

export type PlacementItemPick = PlacementItemSkill & { needsTyped: boolean };

export type PlacementItemPicks = {
  /** The quick questions each picked skill gets beyond the first (`getConfirmingCount`). */
  confirmingCount: number;
  quickFormat: PlacementQuickFormat;
  skills: PlacementItemPick[];
};

function isQuickFormat(format: PlacementItemFormat): format is PlacementQuickFormat {
  return format !== "typed";
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
  covers,
  exam,
  exceptAnswered,
  quickFormat,
  quickNeeded,
  row,
  writesTyped,
}: {
  covers: (item: SkillItem) => boolean;
  exam: PlacementItemExam | null;
  /** Questions the goal's learner already answered don't cover the skill: they won't be asked. */
  exceptAnswered: boolean;
  quickFormat: PlacementQuickFormat;
  quickNeeded: number;
  row: SkillRow;
  writesTyped: boolean;
}): Omit<PlacementItemPick, "usedSituations"> | null {
  const fitting = row.items.filter((item) => covers(item) && !(exceptAnswered && isAnswered(item)));

  const formats = new Set(fitting.map((item) => item.format));
  const quick = fitting.filter((item) => item.format === quickFormat).length;

  if (quick >= quickNeeded) {
    return null;
  }

  return {
    description: row.description,
    exam,
    id: row.id,
    language: row.language,
    level: row.level,
    name: row.name,
    needsTyped: writesTyped && !formats.has("typed"),
    ownerId: row.ownerId,
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
  /** Only placement respects an explicit placement skip; tests and practice may still request questions. */
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
  const { choices, exam, formats: structure } = getPickingExam({ choice, goal });

  const fits = (item: SkillItem) =>
    formats ? fitsExamOptions({ choices, item }) : fitsExamChoice({ choices, item });

  /** Without asked formats, an exam writes its own questions even where general ones exist. */
  const ownExamOnly = Boolean(exam && !formats);

  const quickFormat =
    formats?.find((format) => isQuickFormat(format)) ?? getPlacementQuickFormat(structure);

  const writesTyped = formats?.includes("typed") ?? (goal !== null && confirmsInWriting(goal));
  const confirmingCount = getConfirmingCount({ forPlacement, formats, quickFormat, writesTyped });
  const needed = new Set<ItemFormat>([quickFormat, "typed"]);

  const covers = (item: SkillItem) =>
    needed.has(item.format) &&
    (!ownExamOnly || item.examBlueprintId === exam?.blueprintId) &&
    fits(item);

  const skills = await prisma.skill.findMany({
    select: {
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

  const rules = { covers, exam, exceptAnswered, quickFormat, writesTyped };

  const picks = picked
    .map((id) => skills.find((row) => row.id === id))
    .map((row) =>
      row ? toPick({ ...rules, quickNeeded: quickNeeded + confirmingCount, row }) : null,
    )
    .filter((pick) => pick !== null);

  const usedSituations = await loadUsedSituations({
    examBlueprintId: blueprint?.id,
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
  planRunId,
}: {
  goalId: string;
  planRunId: string | null;
}): Promise<void> {
  await prisma.plan.updateMany({
    data: { placementPreparedAt: new Date() },
    where: { goalId, runId: planRunId },
  });
}
