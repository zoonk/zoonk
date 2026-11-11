import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { loadPlanChangeView } from "../../../plans/_utils/owned-plan";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { getAnsweredQuestions } from "../../../view-models/onboarding/onboarding-steps";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { getAnswerTimeZone } from "../../_utils/owned-goal";
import { FOCUS_TEST_SOURCE, type FocusTestView } from "../focus-test-contract";
import { getSessionQuestions } from "../focus-test-rules";
import {
  type FocusTestSummaryRecord,
  isFocusTestStarted,
  wantsPlacementQuestions,
} from "../focus-test-state";
import { isSameFocus } from "../focus-test-summary";
import {
  type FocusPlan,
  getOffer,
  listFocusRows,
  toFocusTestSummary,
  toFocusTestView,
} from "../focus-test-view";
import { type PlacementEvidence, getPlacementBeliefs } from "../placement-beliefs";
import { getGoalDay } from "../placement-day";
import { type TestSetup, type TestTurn } from "./focus-test-setup";

type FocusFacts = FocusPlan & {
  /** The focus to propose now; null when none is due. */
  due: string[] | null;
};

/** Before the daily time is saved, saving it sets the focus; from then on the test proposes. */
function isTimeSaved(goal: TestSetup["goal"]): boolean {
  const details = isJsonObject(goal.details) ? goal.details : {};
  return goal.planRevealedAt !== null || getAnsweredQuestions(details).includes("schedule");
}

/**
 * The test proposes once the daily time is saved and doesn't cover everything, only while the
 * plan's focus is none or the one the test put there, and never a suggestion it already settled:
 * one the learner answered, or one the plan already follows.
 */
async function loadFocusFacts({
  asks,
  setup,
  suggested,
  timeZone,
  tx,
}: {
  /** The checkpoint shows a focus, so a proposal matters. */
  asks: boolean;
  setup: TestSetup;
  suggested: string[];
  timeZone: string;
  tx: TransactionClient;
}): Promise<FocusFacts> {
  const { coveredShare, focusAreas, id } = setup.plan;
  const timeSaved = isTimeSaved(setup.goal);
  const timeShort = coveredShare !== null && coveredShare < 1;
  const proposes = asks && timeSaved && timeShort;

  const { focus = null, handled = null } = setup.record ?? {};
  const settled = handled !== null && isSameFocus(handled.areas, suggested);

  const waiting = proposes
    ? await tx.planChange.findFirst({
        orderBy: { createdAt: "desc" },
        select: { id: true },
        where: {
          payload: { equals: FOCUS_TEST_SOURCE, path: ["source"] },
          planId: id,
          status: "proposed",
        },
      })
    : null;

  const due =
    proposes &&
    !settled &&
    !isSameFocus(focusAreas, suggested) &&
    isSameFocus(focusAreas, focus ?? []);

  return {
    covered: settled && handled.inPlan,
    due: due ? suggested : null,
    focusAreas,
    proposal: waiting ? await loadPlanChangeView(waiting.id, { timeZone }) : null,
    timeSaved,
    timeShort,
  };
}

type FocusTestLoad = {
  sittingId: string | null;
  /** The focus to propose now; null when none is due. */
  dueFocus: string[] | null;
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

  const focusPlan = await loadFocusFacts({
    asks: dated && progress.answers > 0 && rows.length > 0,
    setup,
    suggested: rows.flatMap((row) => row.areas),
    timeZone,
    tx,
  });

  const offer = getOffer({
    askable: !settled && (found.nextSkillId !== null || !wantsPlacementQuestions(goal)),
    openSubjects: found.openSubjects,
    progress,
  });

  return {
    dueFocus: focusPlan.due,
    sittingId: progress.sitting?.id ?? null,
    summary: toFocusTestSummary({ dated, offer, progress, rows, settled }),
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
