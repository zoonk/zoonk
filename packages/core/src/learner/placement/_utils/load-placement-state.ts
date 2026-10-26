import "server-only";
import { prisma } from "@zoonk/db";
import { toChosenStructure } from "../../../exams/choices/exam-choices";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { readNoticeFormats } from "../../../library/exams/notice-formats";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { type TrueFalseLabels, getTrueFalseLabels } from "../../../library/exams/true-false-labels";
import { ITEM_IMAGE_INCLUDE } from "../../../library/items/item-image";
import { getAreaShares } from "../../../plans/_utils/exam-subject-shares";
import { listFocusedSkillIds } from "../../../plans/planner/focus-targets";
import {
  type PlanGraph,
  type PlanSettings,
  parsePlanGraph,
  parsePlanSettings,
} from "../../../plans/planner/plan-state";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { type PlacementEvidence } from "../placement-beliefs";
import { getPlacementBudgetSpent } from "../placement-budget";
import {
  type PlacementStatus,
  getKnownSubjects,
  getOwnLevel,
  isLevelMeasured,
} from "../placement-contract";
import { getTargetDifficulty } from "../placement-difficulty";
import { type PlacementItemCandidate, pickPlacementItem } from "../placement-item-choice";
import { listKnownByMeasuredLevel, listKnownSkillIds, readSkillStatuses } from "../placement-known";
import { isOwnMaterialTest } from "../placement-material";
import {
  type PlacementQuickFormat,
  confirmsInWriting,
  getPlacementQuickFormat,
} from "../placement-quick-format";
import { type SkillStatuses } from "../placement-status";
import {
  type AreaStart,
  type OwnLevel,
  type PhaseStart,
  getAreaStarts,
  getPhaseStarts,
  getUndecidedSkills,
  isPlacementSettled,
} from "../placement-steps";
import { chooseNextSkill } from "./next-placement-skill";
import { countPlacementAnswers, isPlacementAnswerOn } from "./placement-answers";
import { loadPlacementItems } from "./placement-bank-items";
import { loadEvidence } from "./placement-evidence";
import {
  type PlacementQuestionView,
  parsePlacementItem,
  toPlacementQuestionView,
} from "./placement-items";
import { loadPlanBuild } from "./placement-plan-build";

/**
 * Where placement stands for a goal: each phase's and each area's starting point, whether every
 * one is settled, the next question (null when there's none to ask now) and the skills that
 * still need questions made before placement can settle them.
 */
export type PlacementState = {
  /** This goal's placement answers so far, which number its questions (`countPlacementAnswers`). */
  answered: number;
  areas: AreaStart[];
  /** Every area of every phase has a confident start. False while the plan has no skills yet. */
  complete: boolean;
  /**
   * How much of today's few minutes the day's answers used, from 0 to 1 (`getPlacementBudgetSpent`):
   * how far along today's questions are at most, since placement can stop sooner once it's sure.
   */
  dayBudgetSpent: number;
  /**
   * Today's few minutes of placement are used: it stops for the day with what it knows, and the
   * first week's sessions ask the rest a few at a time.
   */
  dayBudgetUsed: boolean;
  /** The skills placement takes as known: their own answers confirm them (see `listKnownSkillIds`). */
  knownSkillIds: string[];
  needsItems: string[];
  next: PlacementQuestionView | null;
  phases: PhaseStart[];
  /**
   * This goal's placement already has answers (`answered` isn't 0), so a client coming back
   * resumes at `next` instead of showing placement's start.
   */
  started: boolean;
  /** What the client does next (`placementStatusSchema`). */
  status: PlacementStatus;
  /** The words the goal's true-or-false questions are answered with. */
  trueFalseLabels: TrueFalseLabels;
};

/**
 * Each of the plan's areas' share of the exam (`getAreaShares`), counting only the options the
 * learner takes of its choices (ENEM's English or Spanish); null without a notice.
 */
function getChosenAreaShares({
  graph,
  settings,
  structure,
}: {
  graph: PlanGraph;
  settings: PlanSettings;
  structure: ExamStructure | null;
}): Map<string, number> | null {
  return structure
    ? getAreaShares({
        graph,
        structure: toChosenStructure({ choices: settings.examChoices, structure }),
      })
    : null;
}

/**
 * The goal's exam, whose questions placement may ask, how placement asks quickly for it, and the
 * words its statements are answered with.
 */
async function loadGoalExam(goalId: string): Promise<{
  /** A test from the learner's own material: only answered topics are settled (`answeredOnly`). */
  answeredOnly: boolean;
  examBlueprintId: string | null;
  /** The plan's areas the learner said are weak, which placement asks first. */
  /** Each of the plan's areas' share of the exam, when the notice says (`getAreaShares`). */
  areaShares: Map<string, number> | null;
  focusAreas: string[];
  /** The skills the learner asked to focus on: their area's, or the part of it they named. */
  focusedSkillIds: Set<string>;
  goalCreatedAt: Date | null;
  /** The level the learner gave for the goal, stored on it. */
  goalLevel: OwnLevel | null;
  /** The exam's subjects the learner said they know well. */
  knownAreas: string[];
  /** A language level test's measured level, which counts as evidence (see `isLevelMeasured`). */
  measuredLevel: OwnLevel | null;
  quickFormat: PlacementQuickFormat;
  trueFalseLabels: TrueFalseLabels;
  /** A language goal confirms a right quick answer in writing (`confirmsInWriting`). */
  typed: boolean;
}> {
  const goal = await prisma.goal.findUnique({
    include: { examBlueprint: true, plan: { select: { graph: true, settings: true } } },
    where: { id: goalId },
  });

  const blueprint = goal?.examBlueprint ?? null;
  const structure = blueprint ? readBlueprintContent(blueprint).structure : null;
  const notice = readNoticeFormats(goal?.details);
  const graph = parsePlanGraph(goal?.plan?.graph);
  const settings = parsePlanSettings(goal?.plan?.settings);

  return {
    answeredOnly: isOwnMaterialTest(blueprint),
    areaShares: getChosenAreaShares({ graph, settings, structure }),
    examBlueprintId: blueprint?.id ?? null,
    focusAreas: settings.focusAreas,
    focusedSkillIds: listFocusedSkillIds({ graph, settings }),
    goalCreatedAt: goal?.createdAt ?? null,
    goalLevel: goal ? getOwnLevel({ goal }) : null,
    knownAreas: goal ? getKnownSubjects(goal) : [],
    measuredLevel: goal && isLevelMeasured(goal) ? getOwnLevel({ goal }) : null,
    // Before the notice's blueprint is linked, the formats a first pass over it read.
    quickFormat: getPlacementQuickFormat(structure ?? notice),
    trueFalseLabels: getTrueFalseLabels(structure ?? notice),
    typed: goal ? confirmsInWriting(goal) : false,
  };
}

async function loadQuestion(itemId: string | undefined): Promise<PlacementQuestionView | null> {
  if (!itemId) {
    return null;
  }

  const item = await prisma.item.findUnique({ include: ITEM_IMAGE_INCLUDE, where: { id: itemId } });
  const parsed = item ? parsePlacementItem(item) : null;

  return parsed ? toPlacementQuestionView(parsed) : null;
}

/**
 * What the client does next. Without skills, placement waits for the plan, or stops when the run
 * building it gave up (`failed`). With nothing to ask while the day's budget is left and nothing is
 * settled: the question it asks next is still being written (`waitingForQuestions`), or none could
 * be written and the learner has no answer on its skills (`unavailable`), so the learner goes on
 * without placement.
 */
function getStatus({
  buildFailed,
  complete,
  dayBudgetUsed,
  hasEvidence,
  hasNext,
  hasSkills,
  waitsForQuestions,
}: {
  buildFailed: boolean;
  complete: boolean;
  dayBudgetUsed: boolean;
  /** Any answer on the plan's skills, placement's or not. */
  hasEvidence: boolean;
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

  return hasEvidence ? "done" : "unavailable";
}

/**
 * Computes placement from the learner's answers on the goal's skills. Every answer counts, placement
 * or not, so placement never really ends: lessons and reviews keep sharpening the same picture.
 * With `today` (the learner-local day), it stops asking once that day's few minutes are used.
 */
export async function loadPlacementState({
  answer: sessionAnswer = null,
  goalId,
  ownLevel: requestedLevel,
  plan,
  today = null,
  userId,
}: {
  /**
   * A placement question a first-week session just asked, answered: one of placement's own too,
   * though asked inside a session (see `listKnownSkillIds`).
   */
  answer?: PlacementEvidence | null;
  goalId: string;
  /** A level the request gave; the one stored on the goal otherwise. */
  ownLevel?: OwnLevel | null;
  plan: GoalPlan;
  today?: Date | null;
  userId: string;
}): Promise<PlacementState> {
  const skills = plan.skills;
  const skillIds = skills.map((skill) => skill.id);

  const {
    answeredOnly,
    examBlueprintId,
    areaShares,
    focusAreas,
    focusedSkillIds,
    goalCreatedAt,
    goalLevel,
    knownAreas,
    measuredLevel,
    quickFormat,
    trueFalseLabels,
    typed,
  } = await loadGoalExam(goalId);

  const ownLevel = requestedLevel ?? goalLevel;

  const [{ attempts, evidence, placementAnswers, seenItemIds }, { bankItems, build }] =
    await Promise.all([
      loadEvidence({ skillIds, userId }),
      loadPlanBuild({ everySkill: answeredOnly, focusAreas, goalId, knownAreas, ownLevel }).then(
        async (planBuild) => ({
          bankItems: await loadPlacementItems({
            examBlueprintId,
            skillIds,
            typed,
            writingSkillIds: planBuild.preparingSkillIds,
          }),
          build: planBuild,
        }),
      ),
    ]);

  const items: PlacementItemCandidate[] = bankItems.map((item) => ({
    ...item,
    seen: seenItemIds.has(item.id),
  }));

  /** The full material's scope keeps its budget stable as question batches arrive or time out. */
  const topics = answeredOnly ? skills.length : 0;

  const dayBudgetSpent =
    today === null
      ? 0
      : getPlacementBudgetSpent({
          answers: attempts.filter((attempt) => isPlacementAnswerOn({ attempt, day: today })),
          topics,
        });

  const dayBudgetUsed = dayBudgetSpent >= 1;

  const answers = sessionAnswer ? [...placementAnswers, sessionAnswer] : placementAnswers;

  const measuredKnown = new Set(
    listKnownByMeasuredLevel({ evidence, level: measuredLevel, skills }),
  );

  const statuses: SkillStatuses = new Map(
    [
      ...readSkillStatuses({
        answeredOnly,
        answers,
        evidence,
        focusedSkillIds,
        knownAreas,
        ownLevel,
        skills,
      }),
    ].map(([skillId, status]) => [skillId, measuredKnown.has(skillId) ? "known" : status]),
  );

  const complete = isPlacementSettled({ answeredOnly, skills, statuses });
  const askableSkillIds = new Set(items.filter((item) => !item.seen).map((item) => item.skillId));

  const needsItems = getUndecidedSkills({ answeredOnly, skills, statuses })
    .filter((skill) => !askableSkillIds.has(skill.id))
    .map((skill) => skill.id);

  const nextSkillId = chooseNextSkill({
    askableSkillIds,
    choice: { answeredOnly, areaShares, evidence, focusAreas, ownLevel, skills, statuses },
    preparingSkillIds: build.preparingSkillIds,
    quickSkillIds: new Set(
      items.filter((item) => !item.seen && item.format === quickFormat).map((item) => item.skillId),
    ),
  });

  const waitsForNext = nextSkillId !== null && !askableSkillIds.has(nextSkillId);

  const nextItem =
    nextSkillId && !waitsForNext && !build.waitsForExam
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
  const answered = countPlacementAnswers({ attempts, since: goalCreatedAt });

  return {
    answered,
    areas: getAreaStarts({ skills, statuses }),
    complete,
    dayBudgetSpent,
    dayBudgetUsed,
    knownSkillIds: [
      ...new Set([
        ...listKnownSkillIds({ answers, evidence, focusedSkillIds, skillIds }),
        ...measuredKnown,
      ]),
    ],
    needsItems,
    next,
    phases: getPhaseStarts({ skills, statuses }),
    started: answered > 0,
    status: getStatus({
      buildFailed: build.failed,
      complete,
      dayBudgetUsed,
      hasEvidence: evidence.length > 0,
      hasNext: next !== null,
      // A language certificate's skills are known once its blueprint is (see `loadPlanBuild`).
      hasSkills: skills.length > 0 && !build.waitsForExam,
      waitsForQuestions: waitsForNext,
    }),
    trueFalseLabels,
  };
}
