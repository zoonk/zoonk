import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { readDatabaseFacts } from "../../../_utils/read-database-facts";
import { type TrueFalseLabels } from "../../../library/exams/true-false-labels";
import { ITEM_IMAGE_INCLUDE } from "../../../library/items/item-image";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { type FocusTestView } from "../focus-test-contract";
import { type PlacementStatus } from "../placement-contract";
import { type PlacementItemCandidate } from "../placement-item-choice";
import { listKnownByMeasuredLevel, listKnownSkillIds } from "../placement-known";
import {
  type AreaStart,
  type OwnLevel,
  type PhaseStart,
  getAreaStarts,
  getPhaseStarts,
  getUndecidedSkills,
  isPlacementSettled,
} from "../placement-steps";
import { countOpenSubjects, getTestStart, startTestTurn } from "./focus-test-setup";
import { loadFocusTest } from "./load-focus-test";
import { findNextQuestion } from "./next-placement-skill";
import { countPlacementAnswers } from "./placement-answers";
import { getAskingBudget } from "./placement-asking-budget";
import { loadPlacementItems } from "./placement-bank-items";
import { loadAnsweredTestItems, loadEvidence } from "./placement-evidence";
import { loadGoalExam } from "./placement-goal-exam";
import {
  type PlacementQuestionView,
  parsePlacementItem,
  toPlacementQuestionView,
} from "./placement-items";
import { loadPlanBuild } from "./placement-plan-build";
import { readStatuses } from "./placement-statuses";

export type PlacementState = {
  answered: number;
  areas: AreaStart[];
  /** False while the plan has no skills. */
  complete: boolean;
  /** Fraction from 0 to 1; placement can settle before it reaches one. */
  dayBudgetSpent: number;
  /** Unfinished placement continues in first-week sessions after today's budget is used. */
  dayBudgetUsed: boolean;
  /** An exam goal's placement is its Focus test; null for other goals. */
  focusTest: FocusTestView | null;
  knownSkillIds: string[];
  needsItems: string[];
  next: PlacementQuestionView | null;
  phases: PhaseStart[];
  /** Resume at next rather than showing the start screen. */
  started: boolean;
  status: PlacementStatus;
  trueFalseLabels: TrueFalseLabels;
};

async function loadQuestion(
  itemId: string | undefined,
  tx: TransactionClient = prisma,
): Promise<PlacementQuestionView | null> {
  if (!itemId) {
    return null;
  }

  const item = await tx.item.findUnique({ include: ITEM_IMAGE_INCLUDE, where: { id: itemId } });
  const parsed = item ? parsePlacementItem(item) : null;

  return parsed ? toPlacementQuestionView(parsed) : null;
}

function getStatus({
  buildFailed,
  complete,
  dayBudgetUsed,
  hasEvidence,
  hasNext,
  hasSkills,
  tested,
  waitsForQuestions,
}: {
  buildFailed: boolean;
  complete: boolean;
  dayBudgetUsed: boolean;
  /** Any answer on the plan's skills, placement's or not. */
  hasEvidence: boolean;
  hasNext: boolean;
  hasSkills: boolean;
  /** An exam goal's Focus test has nothing to ask outside a sitting, which isn't "unavailable". */
  tested: boolean;
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

  return hasEvidence || tested ? "done" : "unavailable";
}

type PlacementLoad = {
  /** What an exam goal's writes need beside the state; null for other goals. */
  focusTest: Awaited<ReturnType<typeof loadFocusTest>>;
  state: PlacementState;
};

type PlacementRead = {
  goalId: string;
  /** A level the request gave; the one stored on the goal otherwise. */
  ownLevel?: OwnLevel | null;
  plan: GoalPlan;
  today?: Date | null;
  timeZone?: string;
  userId: string;
  tx?: TransactionClient;
};

async function loadPlacementFacts({
  goalId,
  requestedLevel,
  skillIds,
  tx,
  userId,
}: {
  goalId: string;
  requestedLevel: OwnLevel | null | undefined;
  skillIds: string[];
  tx: TransactionClient;
  userId: string;
}) {
  const exam = await loadGoalExam(goalId, tx);
  const ownLevel = requestedLevel ?? exam.goalLevel;

  const [answersRead, { bankItems, build }] = await readDatabaseFacts(
    tx,
    () => loadEvidence({ sittingId: exam.test?.record?.sitting?.id ?? null, skillIds, tx, userId }),
    () =>
      loadPlanBuild({
        askedAt: getTestStart(exam.test),
        everySkill: exam.answeredOnly,
        focusAreas: exam.focusAreas,
        goalId,
        knownAreas: exam.knownAreas,
        ownLevel,
        tx,
      }).then(async (planBuild) => ({
        bankItems: await loadPlacementItems({
          examBlueprintId: exam.examBlueprintId,
          skillIds,
          tx,
          typed: exam.typed,
          writingSkillIds: planBuild.preparingSkillIds,
        }),
        build: planBuild,
      })),
  );

  const answeredItems = await loadAnsweredTestItems({
    itemIds: bankItems.map((item) => item.id),
    tx,
    userId,
  });

  const items: PlacementItemCandidate[] = bankItems.map((item) => ({
    ...item,
    seen: answersRead.seenItemIds.has(item.id) || answeredItems.has(item.id),
  }));

  return { ...answersRead, build, exam, items, ownLevel };
}

/** Uses all answers, not only placement's; today applies the learner-local daily budget. */
export async function loadPlacementWithSummary({
  goalId,
  ownLevel: requestedLevel,
  plan,
  today = null,
  timeZone,
  userId,
  tx = prisma,
}: PlacementRead): Promise<PlacementLoad> {
  const skills = plan.skills;
  const skillIds = skills.map((skill) => skill.id);

  const {
    attempts,
    build,
    evidence,
    exam,
    items,
    ownLevel,
    placementAnswers,
    sittingOutcomes,
    testSkills,
  } = await loadPlacementFacts({ goalId, requestedLevel, skillIds, tx, userId });

  const { answeredOnly, focusAreas, knownAreas, quickFormat } = exam;

  const turn = exam.test
    ? startTestTurn({ setup: exam.test, sittingOutcomes, skills, testSkills })
    : null;

  const budget = getAskingBudget({ attempts, today, turn });

  const measuredKnown = new Set(
    listKnownByMeasuredLevel({ evidence, level: exam.measuredLevel, skills }),
  );

  const { questionStatuses, statuses } = readStatuses({
    answeredOnly,
    answers: placementAnswers,
    evidence,
    knownAreas,
    measuredKnown,
    ownLevel,
    skills,
    testSkills,
    turn,
  });

  const complete = isPlacementSettled({ answeredOnly, skills, statuses });
  const undecided = getUndecidedSkills({ answeredOnly, skills, statuses: questionStatuses });
  const openSubjects = turn ? countOpenSubjects({ turn, undecided }) : 0;
  const settled = turn ? openSubjects === 0 : complete;

  const found = findNextQuestion({
    choice: {
      answeredOnly,
      areaOrder: turn?.areaOrder,
      areaShares: exam.areaShares,
      evidence,
      focusAreas,
      ownLevel,
      skills: turn?.skills ?? skills,
      statuses: questionStatuses,
    },
    items,
    preparingSkillIds: build.preparingSkillIds,
    quickFormat,
    waitsForExam: build.waitsForExam,
  });

  const next = budget.open ? await loadQuestion(found.item?.id, tx) : null;
  const answered = countPlacementAnswers({ attempts, since: exam.goalCreatedAt });

  const focusTest = await loadFocusTest({
    answeredOnly,
    evidence,
    found: {
      asked: next !== null,
      nextSkillId: found.skillId,
      openSubjects,
      waiting: found.waiting,
    },
    plan,
    timeZone,
    today,
    turn,
    tx,
  });

  return {
    focusTest,
    state: {
      answered,
      areas: getAreaStarts({ skills, statuses }),
      complete,
      dayBudgetSpent: budget.spent,
      dayBudgetUsed: budget.used,
      focusTest: focusTest?.view ?? null,
      knownSkillIds: [
        ...new Set([
          ...listKnownSkillIds({ answers: placementAnswers, evidence, skillIds }),
          ...measuredKnown,
        ]),
      ],
      needsItems: undecided
        .filter((skill) => !found.askableSkillIds.has(skill.id))
        .map((skill) => skill.id),
      next,
      phases: getPhaseStarts({ skills, statuses }),
      started: turn ? (turn.progress.sitting?.answered ?? 0) > 0 : answered > 0,
      status: getStatus({
        buildFailed: build.failed,
        complete: settled,
        dayBudgetUsed: !budget.open,
        hasEvidence: evidence.length > 0,
        hasNext: next !== null,
        hasSkills: skills.length > 0 && !build.waitsForExam,
        tested: Boolean(turn),
        waitsForQuestions: found.waiting,
      }),
      trueFalseLabels: exam.trueFalseLabels,
    },
  };
}

export async function loadPlacementState(input: PlacementRead): Promise<PlacementState> {
  const { state } = await loadPlacementWithSummary(input);
  return state;
}
