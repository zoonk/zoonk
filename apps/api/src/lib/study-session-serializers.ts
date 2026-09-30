import { type WeeklyChallengeResult } from "@zoonk/core/checkpoints/weekly-challenge";
import { type WeeklyRecapResult } from "@zoonk/core/milestones/weekly-recap";
import { type StudySessionResult } from "@zoonk/core/sessions/get";
import { type StudySessionSummaryResult } from "@zoonk/core/sessions/summary";
import { type TodayViewResult } from "@zoonk/core/view-models/today/get";

const LOGICAL_DATE_LENGTH = 10;

/** Learner-local dates are stored as UTC-midnight labels; the API sends them as `YYYY-MM-DD`. */
function toLogicalDate(date: Date): string {
  return date.toISOString().slice(0, LOGICAL_DATE_LENGTH);
}

function toOptionalLogicalDate(date: Date | null): string | null {
  return date ? toLogicalDate(date) : null;
}

type StudySessionView = Extract<StudySessionResult, { status: "ready" }>["session"];

export function serializeStudySession(session: StudySessionView) {
  return {
    ...session,
    localDate: toLogicalDate(session.localDate),
    week: {
      ...session.week,
      days: session.week.days.map((day) => ({ ...day, date: toLogicalDate(day.date) })),
    },
  };
}

type TodayView = Extract<TodayViewResult, { status: "ready" }>["today"];

export function serializeToday(today: TodayView) {
  return {
    ...today,
    goal: { ...today.goal, targetDate: toOptionalLogicalDate(today.goal.targetDate) },
    session: serializeStudySession(today.session),
    shortPlan: today.shortPlan
      ? { ...today.shortPlan, mockDate: toOptionalLogicalDate(today.shortPlan.mockDate) }
      : null,
    weeklyChallenge: today.weeklyChallenge
      ? { ...today.weeklyChallenge, date: toOptionalLogicalDate(today.weeklyChallenge.date) }
      : null,
  };
}

type StudySessionSummary = Extract<StudySessionSummaryResult, { status: "ready" }>["summary"];

export function serializeStudySessionSummary(summary: StudySessionSummary) {
  return {
    ...summary,
    capsulesSealed: summary.capsulesSealed.map((capsule) => ({
      ...capsule,
      opensOn: toOptionalLogicalDate(capsule.opensOn),
    })),
    comesBack: summary.comesBack.map((day) => ({ ...day, date: toLogicalDate(day.date) })),
  };
}

type WeeklyChallenge = Extract<WeeklyChallengeResult, { status: "ready" }>["challenge"];

export function serializeWeeklyChallenge(challenge: WeeklyChallenge) {
  return {
    challenge: challenge ? { ...challenge, date: toOptionalLogicalDate(challenge.date) } : null,
  };
}

type WeeklyRecap = Extract<WeeklyRecapResult, { status: "ready" }>["recap"];

function serializeWeekNumbers(week: WeeklyRecap["week"]) {
  return { ...week, daysStudied: week.daysStudied.map((date) => toLogicalDate(date)) };
}

export function serializeWeeklyRecap(recap: WeeklyRecap) {
  return {
    ...recap,
    lastWeek: serializeWeekNumbers(recap.lastWeek),
    turnaround: recap.turnaround
      ? {
          ...recap.turnaround,
          points: recap.turnaround.points.map((point) => ({
            ...point,
            date: toLogicalDate(point.date),
          })),
          rememberedOn: recap.turnaround.rememberedOn.map((date) => toLogicalDate(date)),
        }
      : null,
    week: serializeWeekNumbers(recap.week),
    weekEnd: toLogicalDate(recap.weekEnd),
    weekStart: toLogicalDate(recap.weekStart),
  };
}
