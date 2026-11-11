import { type Goal } from "@zoonk/db";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import {
  type FocusTestSummary,
  type SessionQuestions,
  type TodayFocusTest,
} from "./focus-test-contract";
import { getPaceMs, getSessionQuestions, getSittingMinutes } from "./focus-test-rules";
import { isFocusTestStarted, readFocusTestRecord } from "./focus-test-state";
import { PLACEMENT_WEEK_DAYS } from "./placement-budget";
import { getGoalDay } from "./placement-day";

type TestGoal = Pick<Goal, "createdAt" | "details" | "kind">;

type TestDay = { goal: TestGoal; localDate: Date; timeZone: string };

/**
 * Whether an exam goal's sessions ask the test's questions on a day, from what the goal row keeps.
 * A goal placed before the test kept a summary may still have a subject to ask about.
 */
export function readSessionQuestions({ goal, localDate, timeZone }: TestDay): SessionQuestions {
  const record = readFocusTestRecord(goal);
  const summary = record?.summary;

  return getSessionQuestions({
    complete: summary?.complete ?? false,
    goalDay: getGoalDay({ createdAt: goal.createdAt, localDate, timeZone }),
    paused: Boolean(record?.pausedAt),
    skippedToday: record?.skippedOn === toIsoDate(localDate),
    started: isFocusTestStarted(goal),
    unaskedSubjects: summary ? summary.unasked > 0 : true,
  });
}

function toOffer({ paceMs, questions }: { paceMs: number; questions: number | null }) {
  return questions ? { minutes: getSittingMinutes({ paceMs, questions }), questions } : null;
}

export function isSameFocus(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((area) => b.includes(area));
}

/**
 * The test as the plan's row shows it, read off the goal row. Null for a goal that isn't an exam.
 * A goal placed before the test kept a summary has no numbers until its next test answer.
 */
export function readFocusTestSummary({
  focusAreas,
  ...day
}: TestDay & {
  /** The plan's focus, which is the test's while it's the one the test last put there. */
  focusAreas: readonly string[];
}): FocusTestSummary | null {
  const { goal } = day;

  if (goal.kind !== "exam") {
    return null;
  }

  const record = readFocusTestRecord(goal);
  const summary = record?.summary ?? null;
  const sitting = record?.sitting ?? null;
  const left = sitting ? sitting.questions - sitting.answered : 0;
  const paceMs = summary?.paceMs ?? getPaceMs({ answers: 0, durationMs: 0 });
  const answered = summary ? summary.asked > 0 : isFocusTestStarted(goal);
  const rested = answered ? "checked" : "notStarted";

  return {
    offer: toOffer({ paceMs, questions: left > 0 ? left : (summary?.offerQuestions ?? null) }),
    sessionQuestions: readSessionQuestions(day),
    setsFocus: focusAreas.length > 0 && isSameFocus(focusAreas, record?.focus ?? []),
    state: left > 0 ? "sitting" : rested,
    subjects: summary && summary.asked > 0 ? { asked: summary.asked, total: summary.total } : null,
  };
}

/**
 * Today's one suggestion to take the test: in the goal's first week, while the test isn't started,
 * the plan has a date its time doesn't cover, and the learner hasn't dismissed it.
 */
export function readTodayFocusTest({
  goal,
  localDate,
  timeShort,
  timeZone,
}: TestDay & {
  /** The plan has a date and its time doesn't cover everything by it. */
  timeShort: boolean;
}): TodayFocusTest | null {
  const record = readFocusTestRecord(goal);
  const summary = record?.summary;

  const suggests =
    goal.kind === "exam" &&
    timeShort &&
    summary &&
    summary.total > 1 &&
    !record.dismissedAt &&
    !isFocusTestStarted(goal) &&
    getGoalDay({ createdAt: goal.createdAt, localDate, timeZone }) < PLACEMENT_WEEK_DAYS;

  return suggests ? toOffer({ paceMs: summary.paceMs, questions: summary.offerQuestions }) : null;
}

/** The subjects a short plan would focus, once the learner has a test answer to go by. */
export function readFocusSubjects(
  goal: Pick<Goal, "details">,
): { name: string; shortName: string | null }[] {
  const summary = readFocusTestRecord(goal)?.summary;

  return summary && summary.asked > 0
    ? summary.suggested.map(({ name, shortName }) => ({ name, shortName }))
    : [];
}

/**
 * The focus saving the daily time leaves on a new plan: what the test suggests while the time
 * doesn't cover everything, none once it does. Null changes nothing, as for a focus the learner
 * picked and a goal with no test answer.
 */
export function getDailyTimeFocus({
  focusAreas,
  goal,
  timeShort,
}: {
  focusAreas: readonly string[];
  goal: Pick<Goal, "details" | "kind">;
  timeShort: boolean;
}): string[] | null {
  const record = readFocusTestRecord(goal);
  const summary = record?.summary;

  if (goal.kind !== "exam" || !summary || !isSameFocus(focusAreas, record.focus ?? [])) {
    return null;
  }

  const suggested =
    timeShort && summary.asked > 0 ? summary.suggested.flatMap((subject) => subject.areas) : [];

  return isSameFocus(focusAreas, suggested) ? null : suggested;
}
