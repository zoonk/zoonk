import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { loadPlanChangeView } from "../../../plans/_utils/owned-plan";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { getAnswerTimeZone } from "../../_utils/owned-goal";
import { type FocusRow, type FocusTestView } from "../focus-test-contract";
import { getSessionQuestions } from "../focus-test-rules";
import {
  type FocusTestSummaryRecord,
  isFocusTestStarted,
  wantsPlacementQuestions,
} from "../focus-test-state";
import {
  type FocusPlan,
  getOffer,
  listFocusRows,
  toFocusTestSummary,
  toFocusTestView,
} from "../focus-test-view";
import { type PlacementEvidence, getPlacementBeliefs } from "../placement-beliefs";
import { getGoalDay } from "../placement-day";
import { loadFocusProposalFacts } from "./focus-proposal-facts";
import { type TestTurn } from "./focus-test-setup";

type FocusTestLoad = {
  planId: string;
  plan: FocusPlan;
  sittingId: string | null;
  /** The focus to propose now; null when none is due. */
  dueFocus: string[] | null;
  rows: FocusRow[];
  summary: FocusTestSummaryRecord;
  view: FocusTestView;
};

type FocusTestRead = {
  answeredOnly: boolean;
  evidence: readonly PlacementEvidence[];
  found: {
    /** The state carries the question to ask now. */
    asked: boolean;
    /** The skill the engine would ask next, ready or still being written. */
    nextSkillId: string | null;
    /** Subjects quick questions can check that still have something to ask. */
    openSubjects: number;
    waiting: boolean;
  };
  plan: GoalPlan;
  today: Date | null;
  timeZone?: string;
  tx: TransactionClient;
};

async function loadTurnFocusTest({
  answeredOnly,
  evidence,
  found,
  plan,
  today,
  timeZone: requestedTimeZone,
  turn,
  tx,
}: FocusTestRead & { turn: TestTurn }): Promise<FocusTestLoad> {
  const { progress, setup, subjectOf } = turn;
  const { goal, record } = setup;
  const dated = goal.targetDate !== null;
  const settled = found.openSubjects === 0;
  const timeZone = getAnswerTimeZone({ goal, timeZone: requestedTimeZone });
  const day = today ?? getDateInTimeZone({ date: new Date(), timeZone });

  const rows = listFocusRows({
    beliefs: getPlacementBeliefs({ answeredOnly, evidence, skills: plan.skills }),
    skillsOf: (subject) =>
      plan.skills.filter((skill) => subjectOf(skill.id) === subject.key).map((skill) => skill.id),
    subjects: progress.subjects,
  });

  const facts = await loadFocusProposalFacts({
    asks: dated && progress.answers > 0 && rows.length > 0,
    goal,
    plan: setup.plan,
    record,
    suggested: rows.flatMap((row) => row.areas),
    tx,
  });

  const focusPlan = {
    ...facts,
    proposal: facts.waitingId ? await loadPlanChangeView(facts.waitingId, { timeZone }) : null,
  };

  const offer = getOffer({
    askable: !settled && (found.nextSkillId !== null || !wantsPlacementQuestions(goal)),
    openSubjects: found.openSubjects,
    progress,
  });

  return {
    dueFocus: focusPlan.due,
    plan: focusPlan,
    planId: setup.plan.id,
    rows,
    sittingId: progress.sitting?.id ?? null,
    summary: toFocusTestSummary({
      dated,
      inputsKey: setup.inputsKey,
      offer,
      progress,
      rows,
      settled,
    }),
    view: toFocusTestView({
      asking: {
        nextSubject: found.asked && found.nextSkillId ? subjectOf(found.nextSkillId) : null,
        settled,
        waiting: found.waiting,
      },
      dated,
      lessonsSkipped: plan.items.filter((item) => item.status === "testedOut").length,
      offer,
      plan: focusPlan,
      progress,
      rows,
      sessionQuestions: getSessionQuestions({
        complete: settled,
        goalDay: getGoalDay({ createdAt: goal.createdAt, localDate: day, timeZone }),
        paused: Boolean(record?.pausedAt),
        skippedToday: record?.skippedOn === toIsoDate(day),
        started: isFocusTestStarted(goal),
        unaskedSubjects: progress.subjects.some(
          (subject) => subject.part === null && subject.asked === 0,
        ),
      }),
    }),
  };
}

/** Null for a goal with no Focus test. */
export async function loadFocusTest({
  turn,
  ...read
}: FocusTestRead & { turn: TestTurn | null }): Promise<FocusTestLoad | null> {
  return turn ? loadTurnFocusTest({ ...read, turn }) : null;
}
