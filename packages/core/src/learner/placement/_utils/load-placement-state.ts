import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { readDatabaseFacts } from "../../../_utils/read-database-facts";
import { type TrueFalseLabels } from "../../../library/exams/true-false-labels";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { loadWritingSkillIds } from "../../writing-skills";
import { type FocusTestView } from "../focus-test-contract";
import { type PlacementStatus } from "../placement-contract";
import { type PlacementItemCandidate } from "../placement-item-choice";
import { listKnownSkillIds } from "../placement-known";
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
import { loadAttemptState } from "./load-placement-attempt-state";
import { findNextQuestion } from "./next-placement-skill";
import { countPlacementAnswers } from "./placement-answers";
import { getAskingBudget } from "./placement-asking-budget";
import { type PlacementAttemptView, type PlacementResult } from "./placement-attempt-record";
import { loadPlacementItems } from "./placement-bank-items";
import { loadEvidence, loadSeenPlacementItems } from "./placement-evidence";
import { loadGoalExam } from "./placement-goal-exam";
import { type PlacementQuestionView } from "./placement-items";
import { loadPlanBuild } from "./placement-plan-build";
import { getStatus, loadQuestion } from "./placement-state-view";
import { readStatuses } from "./placement-statuses";

export type PlacementState = {
  answered: number;
  attempt?: PlacementAttemptView | null;
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
  result?: PlacementResult | null;
  /** Resume at next rather than showing the start screen. */
  started: boolean;
  status: PlacementStatus;
  trueFalseLabels: TrueFalseLabels;
};

export type PlacementLoad = {
  attemptFollowUps?: string[];
  attemptHasMore: boolean;
  attemptRemainingSkillIds?: string[];
  /** What an exam goal's writes need beside the state; null for other goals. */
  focusTest: Awaited<ReturnType<typeof loadFocusTest>>;
  state: PlacementState;
};

type PlacementRead = {
  ignoreAttempt?: boolean;
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

  const [answersRead, build, bankItems] = await readDatabaseFacts(
    tx,
    () => loadEvidence({ sittingId: exam.test?.record?.sitting?.id ?? null, skillIds, tx, userId }),
    () =>
      loadPlanBuild({
        askedAt: exam.placement?.attempt
          ? new Date(exam.placement.attempt.partStartedAt)
          : getTestStart(exam.test),
        everySkill: exam.answeredOnly,
        focusAreas: exam.focusAreas,
        goalId,
        knownAreas: exam.knownAreas,
        ownLevel,
        partPrepared: exam.placement?.attempt?.partPrepared,
        requestedSkillIds:
          exam.placement?.attempt?.partSkillIds ?? exam.placement?.attempt?.skillIds,
        tx,
      }),
    () => loadPlacementItems({ examBlueprintId: exam.examBlueprintId, skillIds, tx }),
  );

  const answeredItems = await loadSeenPlacementItems({
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

export type PlacementFacts = Awaited<ReturnType<typeof loadPlacementFacts>>;

/** Uses all answers, not only placement's; today applies the learner-local daily budget. */
export async function loadPlacementWithSummary({
  goalId,
  ignoreAttempt = false,
  ownLevel: requestedLevel,
  plan: goalPlan,
  today = null,
  timeZone,
  userId,
  tx = prisma,
}: PlacementRead): Promise<PlacementLoad> {
  const written = await loadWritingSkillIds(goalId, tx);
  const plan = { ...goalPlan, skills: goalPlan.skills.filter((skill) => !written.has(skill.id)) };
  const skillIds = plan.skills.map((skill) => skill.id);
  const facts = await loadPlacementFacts({ goalId, requestedLevel, skillIds, tx, userId });
  const attempt = facts.exam.placement?.attempt;

  if (attempt && !ignoreAttempt) {
    return loadAttemptState({ attempt, facts, plan, today, tx });
  }

  return loadLegacyPlacement({ facts, plan, timeZone, today, tx });
}

async function loadLegacyPlacement({
  facts,
  plan,
  timeZone,
  today,
  tx,
}: {
  facts: PlacementFacts;
  plan: GoalPlan;
  timeZone?: string;
  today: Date | null;
  tx: TransactionClient;
}): Promise<PlacementLoad> {
  const skills = plan.skills;
  const skillIds = skills.map((skill) => skill.id);

  const {
    attempts,
    build,
    evidence,
    exam,
    items,
    ownLevel,
    confirmationAnswers,
    sittingOutcomes,
    testSkills,
  } = facts;

  const { answeredOnly, focusAreas, knownAreas, quickFormat } = exam;

  const turn = exam.test
    ? startTestTurn({ setup: exam.test, sittingOutcomes, skills, testSkills })
    : null;

  const budget = getAskingBudget({ attempts, today, turn });

  const { questionStatuses, statuses } = readStatuses({
    answeredOnly,
    answers: confirmationAnswers,
    evidence,
    items,
    knownAreas,
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
    attemptHasMore: false,
    focusTest,
    state: {
      answered,
      areas: getAreaStarts({ skills, statuses }),
      attempt: null,
      complete,
      dayBudgetSpent: budget.spent,
      dayBudgetUsed: budget.used,
      focusTest: focusTest?.view ?? null,
      knownSkillIds: listKnownSkillIds({ answers: confirmationAnswers, evidence, skillIds }),
      needsItems: undecided
        .filter((skill) => !found.askableSkillIds.has(skill.id))
        .map((skill) => skill.id),
      next,
      phases: getPhaseStarts({ skills, statuses }),
      result: exam.placement?.result ?? null,
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
