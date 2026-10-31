import "server-only";
import { type GoalUnderstanding, type UnderstoodGoal } from "@zoonk/ai/tasks/goals/understand-goal";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { loadTargetCutoff } from "../../../exams/cutoffs/load-target-cutoff";
import { findMeantExamDay, getKeptMonthStart } from "../../../exams/kept-month";
import { type GoalDraft } from "../../../goals/goal-contract";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { getTargetDateBounds } from "../../../plans/target-date-range";
import { type GoalUnderstandingView, type UnderstoodGoalView } from "../onboarding-contract";
import { type FoundExam, toExamFacts } from "./exam-facts";

/** Start with a sustainable short habit when the learner gave no daily time. */
const DEFAULT_DAILY_MINUTES = 15;

export type UnderstandingContext = {
  goal: string;
  language: string;
  onboardingId: string;
  today: string;
};

type DetailValue = NonNullable<GoalDraft["details"]>[string];

/** The learner's own date, so "this year" and "in March" read from where they are. */
export function getLearnerToday(timeZone: string): string {
  return toIsoDate(getDateInTimeZone({ date: new Date(), timeZone }));
}

function compactDetails(details: Record<string, DetailValue | undefined>) {
  return Object.fromEntries(
    Object.entries(details).filter(
      (entry): entry is [string, DetailValue] => entry[1] !== undefined,
    ),
  );
}

function getAnsweredByWords(understanding: Extract<GoalUnderstanding, { route: "goals" }>) {
  return understanding.dailyMinutes === undefined ? [] : ["schedule"];
}

/** Offer conflicting official notice dates without replacing the learner's month; never offer estimates. */
function getOfferedNoticeDay({
  dates,
  goal,
  today,
}: {
  dates: readonly { date: string; estimated: boolean }[];
  goal: Pick<UnderstoodGoal, "examMonth" | "examYear">;
  today: string;
}): string | undefined {
  const details = { examMonth: goal.examMonth, examYear: goal.examYear };
  const day = findMeantExamDay({ days: dates, details, from: today, goalDate: null });

  if (!day || dates.some((date) => date.estimated)) {
    return undefined;
  }

  return getKeptMonthStart({ details, noticeDay: day.date, today }) ? day.date : undefined;
}

async function toGoalView({
  answered,
  context,
  followUps,
  found,
  goal,
  studyTimeNote,
}: {
  answered: string[];
  context: UnderstandingContext;
  followUps: string[];
  found: FoundExam | null;
  goal: UnderstoodGoal;
  studyTimeNote: string | undefined;
}): Promise<UnderstoodGoalView> {
  const { language, onboardingId, today } = context;
  const exam = found ? toExamFacts(found) : null;

  const details = compactDetails({
    answered,
    examDay: goal.examDay,
    examMonth: goal.examMonth,
    examName: goal.examName,
    examTarget: goal.examTarget,
    examYear: goal.examYear,
    followUps: followUps.map((question) => ({ answer: null, question })),
    institution: goal.institution,
    level: goal.ownLevel,
    levelNote: goal.level,
    nativeLanguage: goal.nativeLanguage,
    offeredNoticeDay: getOfferedNoticeDay({ dates: exam?.dates ?? [], goal, today }),
    onboardingId,
    positionFromReading: goal.targetPosition,
    purpose: goal.purpose,
    reason: goal.reason,
    role: goal.role,
    studyTimeNote,
    subject: goal.subject,
    targetCourse: goal.targetCourse,
    targetPosition: goal.targetPosition,
    targetScore: goal.targetScore,
  });

  const cutoff = await loadTargetCutoff({ details, examBlueprintId: exam?.blueprintId });

  const understoodDate = goal.targetDate ?? exam?.targetDate ?? undefined;

  return {
    cutoff,
    draft: {
      details,
      examBlueprintId: exam?.blueprintId ?? undefined,
      kind: goal.kind,
      language,
      prompt: context.goal,
      // Dates beyond the planner's supported range require another onboarding answer.
      targetDate:
        understoodDate && understoodDate <= getTargetDateBounds(today).max
          ? understoodDate
          : undefined,
      targetLanguage: goal.targetLanguage,
      title: goal.title,
    },
    examDates: exam?.dates ?? [],
  };
}

async function toGoalsView({
  context,
  exams,
  understanding,
}: {
  context: UnderstandingContext;
  exams: readonly (FoundExam | null)[];
  understanding: Extract<GoalUnderstanding, { route: "goals" }>;
}): Promise<GoalUnderstandingView> {
  const answered = getAnsweredByWords(understanding);
  const { studyTimeNote } = understanding;

  const goals = await Promise.all(
    understanding.goals.map((goal, index) =>
      toGoalView({
        answered,
        context,
        // Follow-ups apply only to the main goal that onboarding continues with.
        followUps: index === 0 ? understanding.followUps : [],
        found: exams[index] ?? null,
        goal,
        studyTimeNote,
      }),
    ),
  );

  return {
    goals,
    schedule: {
      dailyMinutes: understanding.dailyMinutes ?? DEFAULT_DAILY_MINUTES,
      studyDays: understanding.studyDays ?? null,
      studyTime: understanding.studyTime ?? null,
      studyTimeNote: understanding.studyTimeNote ?? null,
    },
    status: "goals",
  };
}

/** `exams` is by goal: what the run found for that goal's named exam, or null; learner-supplied targets are kept. */
export async function toUnderstandingView({
  context,
  exams,
  understanding,
}: {
  context: UnderstandingContext;
  exams: readonly (FoundExam | null)[];
  understanding: GoalUnderstanding;
}): Promise<GoalUnderstandingView> {
  switch (understanding.route) {
    case "explain":
      return { question: understanding.question, status: "explain" };
    case "instrument":
      return { instrument: understanding.instrument, status: "instrument" };
    case "goals":
      return toGoalsView({ context, exams, understanding });
    case "unclear":
    case "unsafe":
      return { status: understanding.route };
    default:
      return { status: "unclear" };
  }
}
