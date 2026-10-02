import "server-only";
import { type ItemFormat, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { type TrueFalseLabels, getTrueFalseLabels } from "../../../library/exams/true-false-labels";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { type PlacementEvidence, getPlacementBeliefs } from "../placement-beliefs";
import { isPlacementBudgetUsed } from "../placement-budget";
import { type PlacementStatus } from "../placement-contract";
import { getTargetDifficulty } from "../placement-difficulty";
import { pickPlacementItemSkillIds } from "../placement-item-picks";
import { type PlacementQuickFormat, getPlacementQuickFormat } from "../placement-quick-format";
import {
  type AreaStart,
  type OwnLevel,
  type PhaseStart,
  type PlacementItemCandidate,
  chooseNextPlacementSkill,
  getAreaStarts,
  getPhaseStarts,
  getSkillPlacementStatus,
  getUndecidedSkills,
  isPlacementSettled,
  pickPlacementItem,
} from "../placement-steps";
import {
  PLACEMENT_ITEM_FORMATS,
  type PlacementQuestionView,
  parsePlacementItem,
  toPlacementQuestionView,
} from "./placement-items";

/**
 * Where placement stands for a goal: each phase's and each area's starting point, whether every
 * one is settled, the next question (null when there's none to ask now) and the skills that
 * still need questions made before placement can settle them.
 */
export type PlacementState = {
  answered: number;
  areas: AreaStart[];
  /** Every area of every phase has a confident start. False while the plan has no skills yet. */
  complete: boolean;
  /**
   * Today's few minutes of placement are used: it stops for the day with what it knows, and the
   * first week's sessions ask the rest a few at a time.
   */
  dayBudgetUsed: boolean;
  knownSkillIds: string[];
  needsItems: string[];
  next: PlacementQuestionView | null;
  phases: PhaseStart[];
  /** What the client does next (`placementStatusSchema`). */
  status: PlacementStatus;
  /** The words the goal's true-or-false questions are answered with. */
  trueFalseLabels: TrueFalseLabels;
};

/** Most skills need one or two questions: more than 1000 answers on one goal's skills is noise. */
const MAX_EVIDENCE = 1000;

type AttemptRow = {
  answer: unknown;
  durationMs: number;
  isCorrect: boolean;
  item: { format: ItemFormat } | null;
  itemId: string | null;
  localDate: Date;
  skillId: string | null;
  stepId: string | null;
  studySessionId: string | null;
};

function getOutcome(attempt: AttemptRow): PlacementEvidence["outcome"] {
  if (attempt.isCorrect) {
    return "correct";
  }

  return isJsonObject(attempt.answer) && attempt.answer.dontKnow === true ? "dontKnow" : "wrong";
}

function toEvidence(attempt: AttemptRow): PlacementEvidence | null {
  if (!attempt.skillId) {
    return null;
  }

  return {
    // Lesson screens aren't bank items; their questions are about as guessable as multiple choice.
    format: attempt.item?.format ?? "multipleChoice",
    outcome: getOutcome(attempt),
    skillId: attempt.skillId,
  };
}

export async function loadEvidence({ skillIds, userId }: { skillIds: string[]; userId: string }) {
  const attempts = await prisma.attempt.findMany({
    orderBy: { answeredAt: "desc" },
    select: {
      answer: true,
      durationMs: true,
      isCorrect: true,
      item: { select: { format: true } },
      itemId: true,
      localDate: true,
      skillId: true,
      stepId: true,
      studySessionId: true,
    },
    take: MAX_EVIDENCE,
    where: { skillId: { in: skillIds }, userId },
  });

  const chronological = attempts.toReversed();

  return {
    attempts: chronological,
    evidence: chronological.map((attempt) => toEvidence(attempt)).filter((item) => item !== null),
    seenItemIds: new Set(chronological.map((attempt) => attempt.itemId)),
  };
}

/**
 * Placement's own answers on one learner-local day: bank questions answered outside a lesson and
 * outside a session (sessions carry their own few questions).
 */
function isPlacementAnswerOn({ attempt, day }: { attempt: AttemptRow; day: Date }): boolean {
  return (
    attempt.itemId !== null &&
    attempt.stepId === null &&
    attempt.studySessionId === null &&
    attempt.localDate.getTime() === day.getTime()
  );
}

/**
 * The questions placement may ask on these skills: general ones and the goal's exam's, never
 * another exam's (a shared skill's "on the first day of ENEM…" question isn't for a police exam).
 */
export function loadPlacementItems({
  examBlueprintId,
  skillIds,
}: {
  examBlueprintId: string | null;
  skillIds: string[];
}) {
  return prisma.item.findMany({
    orderBy: { id: "asc" },
    select: { difficulty: true, format: true, id: true, skillId: true },
    where: {
      format: { in: [...PLACEMENT_ITEM_FORMATS] },
      skillId: { in: skillIds },
      ...getItemAudienceFilter({ examBlueprintId }),
    },
  });
}

/**
 * The goal's exam, whose questions placement may ask, how placement asks quickly for it, and the
 * words its statements are answered with.
 */
async function loadGoalExam(
  goalId: string,
): Promise<{
  examBlueprintId: string | null;
  quickFormat: PlacementQuickFormat;
  trueFalseLabels: TrueFalseLabels;
}> {
  const goal = await prisma.goal.findUnique({
    select: { examBlueprint: true },
    where: { id: goalId },
  });

  const blueprint = goal?.examBlueprint ?? null;
  const structure = blueprint ? readBlueprintContent(blueprint).structure : null;

  return {
    examBlueprintId: blueprint?.id ?? null,
    quickFormat: getPlacementQuickFormat(structure),
    trueFalseLabels: getTrueFalseLabels(structure),
  };
}

async function loadQuestion(itemId: string | undefined): Promise<PlacementQuestionView | null> {
  if (!itemId) {
    return null;
  }

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  const parsed = item ? parsePlacementItem(item) : null;

  return parsed ? toPlacementQuestionView(parsed) : null;
}

/**
 * A plan whose run never recorded the end of placement's questions (a lost run, or a plan built
 * before the run recorded it) stops waiting for them this long after its graph was written.
 */
const QUESTION_WRITING_WINDOW_MS = 10 * 60 * 1000;

/** How the run building the goal's plan went, as placement needs it. */
type PlanBuild = {
  /** The run gave up before the plan had skills: nothing will come until it's started again. */
  failed: boolean;
  /** The skills whose placement questions are still being written: none once writing ended. */
  preparingSkillIds: Set<string>;
};

async function loadPlanBuild(goalId: string): Promise<PlanBuild> {
  const plan = await prisma.plan.findUnique({
    select: {
      buildFailedAt: true,
      createdAt: true,
      generatedAt: true,
      graph: true,
      placementPreparedAt: true,
    },
    where: { goalId },
  });

  if (!plan) {
    return { failed: false, preparingSkillIds: new Set() };
  }

  const graphWrittenAt = plan.generatedAt ?? plan.createdAt;

  const writing =
    plan.placementPreparedAt === null &&
    Date.now() - graphWrittenAt.getTime() < QUESTION_WRITING_WINDOW_MS;

  return {
    failed: plan.buildFailedAt !== null,
    preparingSkillIds: new Set(
      writing ? pickPlacementItemSkillIds(parsePlanGraph(plan.graph)) : [],
    ),
  };
}

/**
 * What the client does next. Without skills, placement waits for the plan, or stops when the run
 * building it gave up (`failed`). With nothing to ask while the day's budget is left and nothing is
 * settled: the question it asks next is still being written (`waitingForQuestions`), or none could
 * be written and none were answered (`unavailable`), so the learner goes on without placement.
 */
function getStatus({
  answered,
  buildFailed,
  complete,
  dayBudgetUsed,
  hasNext,
  hasSkills,
  waitsForQuestions,
}: {
  answered: number;
  buildFailed: boolean;
  complete: boolean;
  dayBudgetUsed: boolean;
  hasNext: boolean;
  hasSkills: boolean;
  waitsForQuestions: boolean;
}): PlacementStatus {
  if (!hasSkills) {
    return buildFailed ? "failed" : "preparing";
  }

  if (hasNext) {
    return "asking";
  }

  if (complete || dayBudgetUsed) {
    return "done";
  }

  if (waitsForQuestions) {
    return "waitingForQuestions";
  }

  return answered === 0 ? "unavailable" : "done";
}

/**
 * Computes placement from the learner's answers on the goal's skills. Every answer counts, placement
 * or not, so placement never really ends: lessons and reviews keep sharpening the same picture.
 * With `today` (the learner-local day), it stops asking once that day's few minutes are used.
 */
export async function loadPlacementState({
  goalId,
  ownLevel,
  plan,
  today = null,
  userId,
}: {
  goalId: string;
  ownLevel?: OwnLevel | null;
  plan: GoalPlan;
  today?: Date | null;
  userId: string;
}): Promise<PlacementState> {
  const skills = plan.skills;
  const skillIds = skills.map((skill) => skill.id);

  const { examBlueprintId, quickFormat, trueFalseLabels } = await loadGoalExam(goalId);

  const [{ attempts, evidence, seenItemIds }, bankItems, build] = await Promise.all([
    loadEvidence({ skillIds, userId }),
    loadPlacementItems({ examBlueprintId, skillIds }),
    loadPlanBuild(goalId),
  ]);

  const dayBudgetUsed =
    today !== null &&
    isPlacementBudgetUsed(
      attempts.filter((attempt) => isPlacementAnswerOn({ attempt, day: today })),
    );

  const items: PlacementItemCandidate[] = bankItems.map((item) => ({
    ...item,
    seen: seenItemIds.has(item.id),
  }));

  const beliefs = getPlacementBeliefs({ evidence, skills });
  const complete = isPlacementSettled({ beliefs, skills });
  const askableSkillIds = new Set(items.filter((item) => !item.seen).map((item) => item.skillId));

  const needsItems = getUndecidedSkills({ beliefs, skills })
    .filter((skill) => !askableSkillIds.has(skill.id))
    .map((skill) => skill.id);

  // Skills whose questions are still being written count as askable, so placement keeps its own
  // order while they're written: it waits for the one it asks next instead of asking another.
  const nextSkillId = chooseNextPlacementSkill({
    askableSkillIds: new Set([...askableSkillIds, ...build.preparingSkillIds]),
    beliefs,
    evidence,
    ownLevel,
    skills,
  });

  const waitsForNext = nextSkillId !== null && !askableSkillIds.has(nextSkillId);

  const nextItem =
    nextSkillId && !waitsForNext
      ? pickPlacementItem({
          confirming: evidence.some(
            (answer) => answer.skillId === nextSkillId && answer.outcome === "correct",
          ),
          items,
          quickFormat,
          skillId: nextSkillId,
          targetDifficulty: getTargetDifficulty({
            evidence,
            ownLevel,
            skillId: nextSkillId,
            skills,
          }),
        })
      : null;

  const next = dayBudgetUsed ? null : await loadQuestion(nextItem?.id);

  return {
    answered: evidence.length,
    areas: getAreaStarts({ beliefs, skills }),
    complete,
    dayBudgetUsed,
    knownSkillIds: skillIds.filter(
      (skillId) => getSkillPlacementStatus(beliefs.get(skillId)) === "known",
    ),
    needsItems,
    next,
    phases: getPhaseStarts({ beliefs, skills }),
    status: getStatus({
      answered: evidence.length,
      buildFailed: build.failed,
      complete,
      dayBudgetUsed,
      hasNext: next !== null,
      hasSkills: skills.length > 0,
      waitsForQuestions: waitsForNext,
    }),
    trueFalseLabels,
  };
}
